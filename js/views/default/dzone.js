define([
    'jquery',
    'underscore',
    'backbone',
    'views/default/swal',
    'module',
    'views/base',
    'views/uploads/upload_folder',
    'text!templates/uploads/upload.html',
    'text!templates/uploads/upload_activate.html',
    'dropzone',
    'text!templates/default/dzone.html',
    'text!templates/default/load-error.html'
], function($, _, Backbone, swal, module, 
            BaseView, UploadFolder,
            UploadTemplate, UploadActivateTemplate,
            Dropzone, DropzoneTemplate, LoadErrorTemplate) {
    var advancedUploadView = BaseView.extend({
        className: 'dzone',
        options: function() {
            var tmpl = _.template(DropzoneTemplate);
            return {
                url: webgnome.config.api + '/uploads',
                previewTemplate: tmpl(),
                maxFilesize: 2048,
                maxFiles: 255,
                autoProcessQueue: false,
                parallelUploads: 255,
                dictDefaultMessage: 'Drop file here to add (or click to navigate).<br> Click the help icon for details on supported file formats.',
                //GNOME / API options
                obj_type: undefined,
                filelist: false,
                timeout: 300000,
                kwargs: {},
            };
        },

        initialize: function(options) {
            _.defaults(options, this.options());
            this.options = options;
            BaseView.prototype.initialize.call(this, options);
            this.render();
            if (options.autoProcessQueue) {
                this.$('.confirm').hide();
            }
            this.orderedFileList = [];
        },

        render: function(options) {
            BaseView.prototype.render.call(this, options);
            this.setupUpload();
        },

        setupUpload: function() {
            var tmpl;
            if (webgnome.config.can_persist) {
                tmpl = _.template(UploadActivateTemplate);
                this.$el.append(tmpl({page: false}));

                this.$el.find(".nav-tabs a").click(function(ev){
                    // bootstrap (3.4.1), the tabs work the first time,
                    // but stop working after that.  So we need to brute-force
                    // the showing of the tab panes.
                    ev.preventDefault();
                    let top = $(this.parentElement.parentElement.parentElement);
                    let paneID = $(this)[0].getAttribute('href');
                    
                    top.find('li').removeClass('active');
                    top.find('.tab-pane').removeClass('active');
                    
                    $(this).tab('show');
                    top.find(paneID).addClass('active');
                });
            }
            else {
                tmpl = _.template(UploadTemplate);
                this.$el.append(tmpl(UploadTemplate));
            }

            this.options.params = this.sending;

            this.dropzone = this.$('.dropzone').dropzone(this.options)[0].dropzone;

            this.dropzone.on('uploadprogress', _.bind(this.progress, this));
            this.dropzone.on('success', _.bind(this.processSuccess, this));
            this.dropzone.on('complete', _.bind(this.complete, this));
            this.dropzone.on('error', _.bind(this.uploadError, this));
            this.dropzone.on('success', _.bind(this.trigger, this, 'success'));
            this.dropzone.on('complete', _.bind(this.trigger, this, 'complete'));
            this.dropzone.on('error', _.bind(this.trigger, this, 'error'));
            
            if (!this.options.autoProcessQueue) {
                // There are two ways in which a piece of html can be hidden.
                // There can be a hidden attribute, or there can be a style
                // "display: none".  We try to show the content regardless of
                // how it was hidden.
                this.$('.confirm').show();
                this.$('.confirm').removeAttr('hidden');
            }

            if (webgnome.config.can_persist) {
                this.uploadFolder = new UploadFolder({el: this.$(".upload-folder")});
                this.listenTo(this.uploadFolder, 'activate-file', _.bind(function(filelist, name){ this.trigger('upload_complete', filelist, name);}, this));
                this.uploadFolder.render();
            }
        },

        sending: function(files, xhr, chunked) {
            var params = {};
            params.action = 'upload_files';
            params.session = localStorage.getItem('session');
            if ( $('input#persist_upload').length > 0){
                params.persist_upload = $('input#persist_upload')[0].checked;
            }
            return params;
        },

        processSuccess(file, response) {
            file.serverFilename = JSON.parse(response);
            if (this.dropzone.files.length === 0) {
                console.error('shouldnt happen!');
            }
            if (this.dropzone.files.length === this.dropzone.getFilesWithStatus('success').length) {
                this.trigger('upload_complete', _.pluck(this.dropzone.files, 'serverFilename'), this.dropzone.files[0].name);
            }
        },

        complete(e) {
            var elem = e.previewElement;
            $('.spinner', elem).hide();
            $('.upload-success', elem).show();
        },

        progress: function(e, percent) {
            if (percent === 100) {
                this.$('.dz-preview').addClass('dz-uploaded');
                this.$('.dz-loading').fadeIn();
            }
        },

        uploadError: function(file, err) {
            //Function that handles an error created by dropzone for some upload related failure.
            //For example if the file is too big, or the upload itself failed.
            //var errObj = JSON.parse(err);
            console.error(err);

            if (typeof err === 'string') {
                err = [err];
            }

            let loadErrorTemplate = _.template(LoadErrorTemplate);
            this.$('.dz-error-message span')[0].innerHTML = loadErrorTemplate({
                errmsg: err
            });

            this.$('.dz-error-ok-btn').on("click", _.bind(function() {
                this.$('.dropzone').removeClass('dz-started');
                this.dropzone.removeAllFiles();
            }, this));
        },

        reset: function(jqXHR, textStatus, errorThrown) {
            //Function that handles errors that occur after files have been uploaded. For example,
            //if upload completion triggers a request (in the parent form) to create a mover
            //which then fails, this function can handle the event.
            //If additional behavior is desired, have the form handle the event, and then have that
            //handler call this to reset the dropzone.
            //var errObj = JSON.parse(err);
            $('.dz-error-message span')[0].innerHTML = errorThrown;
            var fileElems = $('.dz-preview');

            for (var i = 1; i < fileElems.length; i++) {
                $(fileElems[i]).hide();
            }

            $('.dz-progress', fileElems.first()).hide();
            $('.dz-loading', fileElems.first()).hide();

            var err = JSON.parse(jqXHR.responseText);
            var message = [];

            if (jqXHR.status === 415) {
                //Expound on the specific error here.
                if (errorThrown === 'Unsupported Media Type') {
                    message.push('Failed to create requested object from file');
                }
            }

            message.push(err.message[0]);
            this.dropzone.emit('error', this.dropzone.files[0], message);
        },

        close:  function() {
            if (this.uploadFolder) {
                this.uploadFolder.close();
            }
            if (this.dropzone) {
                this.dropzone.disable();
                $('input.dz-hidden-input').remove();
            }

            BaseView.prototype.close.call(this);
        },
    });
    return advancedUploadView;
});
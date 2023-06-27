define([
    'jquery',
    'underscore',
    'backbone',
    'dropzone',
    'views/default/swal',
    'model/gnome',
    'model/environment/waves',
    'views/uploads/upload_folder',
    'text!templates/default/load.html',
    'text!templates/default/load-error.html',
    'text!templates/uploads/upload.html',
    'text!templates/uploads/upload_activate.html',
    'text!templates/default/dzone.html'
], function($, _, Backbone, Dropzone, swal,
            GnomeModel, WavesModel, UploadFolder,
            LoadTemplate, LoadErrorTemplate,
            UploadTemplate, UploadActivateTemplate, DropzoneTemplate) {
    'use strict';
    var loadView = Backbone.View.extend({
        className: 'page load',
        initialize: function(options) {
            if (_.isUndefined(options)) { options = {}; }
            _.defaults(options, {
                simple: false,
                page: true
            });

            this.render(options);
        },

        render: function(options) {
            var template;
            if (options.simple) {
                template = _.template(LoadTemplate);
            } else if (webgnome.config.can_persist) {
                template = _.template(UploadActivateTemplate);
            } else {
                template = _.template(UploadTemplate);
            }

            this.$el.html(template(options));

            if (!options.simple) {
                $('body').append(this.$el);
            }

            // When going into manual setup, opening a dropzone (e.g. uploading
            // a current file), and then navigating back to the main page,
            // Dropzone is now reporting an error 'Dropzone already attached'.
            // So we need to clear out any previous instances if there are any.
            // To add to the fun, destroying a dropzone instance is an async
            // operation.
            var promises = Dropzone.Dropzone.instances.map( (dz) => {
                var result = dz.destroy();
                return new Promise((res, rej) => { res(result); });
            });

            Promise.all(promises)
            .then((results) => {
                console.log('creating new dropzone...');
                Dropzone.autoDiscover = false;
                this.dropzone = new Dropzone.Dropzone('.dropzone', {
                    url: webgnome.config.api + '/upload',
                    previewTemplate: _.template(DropzoneTemplate)(),
                    paramName: 'new_model',
                    maxFiles: 1,
                    maxFilesize: webgnome.config.upload_limits.save, // 2GB
                    acceptedFiles: '.zip, .gnome',
                    timeout: 300000,
                    dictDefaultMessage: 'Drop file here <br> (or click to navigate)'
                });
                this.dropzone.on('sending', _.bind(this.sending, this));
                this.dropzone.on('uploadprogress', _.bind(this.progress, this));
                this.dropzone.on('error', _.bind(this.reset, this));
                this.dropzone.on('success', _.bind(this.loaded, this));
            });

            if (!options.simple && webgnome.config.can_persist) {
                this.uploadFolder = new UploadFolder({el: $(".upload-folder")});
                this.uploadFolder.on("activate-file", _.bind(this.activateFile, this));
                this.uploadFolder.render();
            }
        },

        sending: function(e, xhr, formData) {
            formData.append('session', localStorage.getItem('session'));
        },

        reset: function(file, err) {
            console.error(err);
            let errmsg;

            try {
                var errObj = JSON.parse(err);
                errmsg = errObj.exc_type + ': ' + errObj.message;
            }
            catch(exc) {
                errmsg = err;
            }

            let loadErrorTemplate = _.template(LoadErrorTemplate);

            this.$('.dz-error-message span')[0].innerHTML = loadErrorTemplate({
                errmsg: [errmsg]
            });

            this.$('.dz-error-ok-btn').on("click", _.bind(function() {
                this.$('.dropzone').removeClass('dz-started');
                this.dropzone.removeAllFiles();
            }, this));
        },

        progress: function(e, percent) {
            if (percent === 100) {
                this.$('.dz-preview').addClass('dz-uploaded');
                this.$('.dz-loading').fadeIn();
            }
        },

        modelHasWeatherers: function(model) {
            var weatherers = model.get('weatherers');
            var weathererKeys = Object.keys(webgnome.model.model.weatherers);
            var invalidWeatherers = [];

            for (var i = weathererKeys.length - 1; i >= 0; i--) {
                if (weathererKeys[i].indexOf('cleanup') !== -1 ||
                    weathererKeys[i].indexOf('beaching') !== -1 ||
                    weathererKeys[i].indexOf('roc') !== -1 ||
                    weathererKeys[i].indexOf('dissolution') !== -1)
                {
                    weathererKeys.splice(i, 1);
                }
            }

            for (var j = 0; j < weathererKeys.length; j++) {
                var weathererExists = weatherers.findWhere({'obj_type': weathererKeys[j]});
                if (!weathererExists) {
                    invalidWeatherers.push(weathererKeys[j]);
                }
            }

            return invalidWeatherers;
        },

        modelHasOutputters: function(model) {
            var outputters = model.get('outputters');
            var outputterKeys = Object.keys(webgnome.model.model.outputters);
            var invalidOutputters = [];

            for (var i = 0; i < outputterKeys.length; i++) {
                var isNonStandardOutputter = webgnome.model.nonStandardOutputters.indexOf(outputterKeys[i]) > -1;
                var outputterExists = outputters.findWhere({'obj_type': outputterKeys[i]});
                if (!outputterExists && !isNonStandardOutputter) {
                    invalidOutputters.push(outputterKeys[i]);
                }
            }
            
            return invalidOutputters;
        },

        removeInvalidOutputters: function(model) {
            //Removes outputters that should not be in model save files (NetCDFOutput, etc)
            var outputters = model.get('outputters');
            var invalidTypes = webgnome.model.nonStandardOutputters;
            var isInvalid;

            for (var i = 0; i < outputters.models.length; i++) {
                isInvalid = $.inArray(outputters.models[i].get('obj_type'), invalidTypes);
                if (isInvalid !== -1) {
                    outputters.remove(outputters.models[i].get('id'));
                }
            }
        },

        loaded: function(fileobj, resp) {
            if (resp === 'UPDATED_MODEL') {
                swal.fire({
                    title: 'Old Save File Detected',
                    text: 'Compatibility changes may hae been made. It is HIGHLY recommended to verify and re-save the model after loading',
                    icon: 'warning',
                    closeOnConfirm: true,
                    confirmButtonText: 'Ok'
                });
            }

            webgnome.model = new GnomeModel();
            webgnome.model.fetch({
                success: _.bind(function(model, response, options) {
                    model.setupTides();
                    var map = model.get('map');
                    var spills = model.get('spills').models;

                    var locationExists = (map.get('map_bounds')[0][0] !== -360) && (map.get('map_bounds')[0][1] !== 90);
                    var invalidSpills = [];
                    /* JAH: Removed this because I don't think it's relevant anymore
                    and shouldn't be handled here anyway
                    for (var i = 0; i < spills.length; i++) {

                        if (model.get('mode') === 'adios') {
                            spills[i].get('release').durationShift(model.get('start_time'));
                            //invalidSpills.push(spills[i].get('name'));
                        } else if (spills[i].get('release').get('end_position')[0] === 0 && spills[i].get('release').get('end_position')[1] === 0) {
                            if (spills[i].get('release').get('start_position')[0] === 0 && spills[i].get('release').get('start_position')[1] === 0) {
                            }
                            else {
                                var start_position = spills[i].get('release').get('start_position');
                                spills[i].get('release').set('end_position', start_position);
                                invalidSpills.push(spills[i].get('name'));
                            }
                        }

                        if (_.isNull(spills[i].get('release').get('end_release_time'))) {
                            var start_time = spills[i].get('release').get('release_time');
                            spills[i].get('release').set('end_release_time', start_time);
                        }
                    }
                    */

                    var neededModels = this.modelHasWeatherers(model).concat(this.modelHasOutputters(model));
                    var waves = model.get('waves');
                    if (webgnome.isUorN(waves)) {
                        waves = new WavesModel();
                        model.get('environment').add(waves);
                    }

                    var neededModelsStr = '';
                    var invalidSpillsStr = '';

                    for (var s = 0; s < neededModels.length; s++) {
                        neededModelsStr += neededModels[s] + '\n';
                    }

                    for (var j = 0; j < invalidSpills.length; j++) {
                        invalidSpillsStr += invalidSpills[j] + '\n';
                    }

                    var msg = '';
                    this.removeInvalidOutputters(model);
                    for (var w = 0; w < webgnome.model.get('weatherers').models.length; w++) {
                        if (webgnome.model.get('weatherers').models[w].get('on')) {
                            webgnome.model.set('weathering_activated', true);
                            break;
                        }
                    }

                    if (neededModels.length > 0 || invalidSpills.length > 0) {
                        if (neededModels.length > 0) {
                            msg += 'The components listed below will be added to the model.<br /><br /><code>' + neededModelsStr + '</code><br />';
                        }

                        if (invalidSpills.length > 0) {
                            msg += 'The following spill(s) were altered to be compatible.<br /><br /><code>' + invalidSpillsStr + '</code><br />';
                        }

                        swal.fire({
                            title: 'Save File Compliance',
                            html: 'Some components of the Save File are not supported or are missing.' + msg,
                            icon: 'warning',
                            closeOnConfirm: true,
                            confirmButtonText: 'Ok'
                        }).then(function(result) {
                            if (result.isConfirmed) {
                                for (var i = 0; i < neededModels.length; i++) {
                                    if (neededModels[i].indexOf('outputters') !== -1) {
                                        var outputterModel = new webgnome.model.model.outputters[neededModels[i]]();
                                        webgnome.model.get('outputters').add(outputterModel);
                                    } else if (neededModels[i].indexOf('weatherers') !== -1) {
                                        var weathererModel = new webgnome.model.model.weatherers[neededModels[i]]({on: false});
                                        webgnome.model.get('weatherers').add(weathererModel);
                                    }
                                }

                                var water = model.get('environment').findWhere({'obj_type': 'gnome.environment.water.Water'});
                                var wind = model.get('environment').findWhere({'obj_type': 'gnome.environment.wind.Wind'});

                                webgnome.model.save(null, {
                                    validate: false,
                                    success: function() {
                                        webgnome.router.navigate('config', true);
                                    }
                                });

                                webgnome.router._cleanup();
                            }
                        });
                    } else {
                        webgnome.router._cleanup();
                        webgnome.router.navigate('config', true);
                    }
                }, this)
            });
        },

        activateFile: function(filePath) {
            if (this.$('.popover').length === 0) {
                var thisForm = this;

                $.post('/activate', {'file-name': filePath})
                .done(function(response) {
                    thisForm.loaded(filePath, response);
                });
            }
        },

        close: function() {
            this.dropzone.disable();
            $('input.dz-hidden-input').remove();
            Backbone.View.prototype.close.call(this);
        }
    });

    return loadView;
});

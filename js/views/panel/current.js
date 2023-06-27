define([
    'jquery',
    'underscore',
    'backbone',
    'cesium',
    'views/default/swal',
    'text!templates/panel/current.html',
    'text!templates/panel/currentpanelitem.html',
    'collection/goods_requests_collection',
    'views/panel/goodsrequestitem',
    'views/cesium/cesium',
    'views/panel/base',
    'views/form/mover/current_type',
    'views/form/mover/grid_current',
    'views/form/mover/cats',
    'views/form/mover/component',
    'views/modal/base',
    'views/modal/form',
    'views/form/mover/upload'
], function($, _, Backbone, Cesium, swal,
            CurrentPanelTemplate, CurrentPanelItemTemplate, GoodsRequestCollection, GoodsRequestItemView,
            CesiumView, BasePanel, CreateMoverForm, GridCurrentMoverForm, CatsMoverForm, ComponentMoverForm,
            BaseModal, FormModal, MoverUploadForm) {
    var currentPanel = BasePanel.extend({
        className: 'col-md-3 current object panel-view',

        models: [
            'gnome.movers.c_current_movers.CatsMover',
            'gnome.movers.c_current_movers.ComponentMover',
            'gnome.movers.c_current_movers.c_GridCurrentMover',
            'gnome.movers.py_current_movers.CurrentMover',
            'gnome.movers.c_current_movers.CurrentCycleMover'
        ],

        forms: {
            'gnome.movers.c_current_movers.CatsMover': CatsMoverForm,
            'gnome.movers.c_current_movers.ComponentMover': ComponentMoverForm
        },
        events: {
            'click #mini-currentmap': 'openMapModal',
            'click .current-row': 'changeDisplayedCurrent',
            'webkitfullscreenchange #mini-currentmap': 'resetCamera',
            'mozfullscreenchange #mini-locmap' : 'resetCamera',
            'msfullscreenchange #mini-locmap' : 'resetCamera',
            'fullscreenchange #mini-locmap' : 'resetCamera',
            'click .cancel-request': 'cancelRequestHandler',
            'click .pause-request': 'pauseRequestHandler'
        },

        mapName: '#mini-currentmap',

        template: CurrentPanelTemplate,

        envtype: 'surface currents',

        initialize: function(options) {
            BasePanel.prototype.initialize.call(this, options);
            //_.extend({}, BasePanel.prototype.events, this.events);
            _.extend(this.events, BasePanel.prototype.events);
            this.currentPrims = {};
            this.currentPromises = {};
            this.listenTo(webgnome.goodsRequests, 'add change remove', this.render);
            this.listenTo(webgnome.model.get('movers'),
                          'add change remove',
                          this.render);
            this.mozResetCamera = _.bind(function(e){
                this.resetCamera(e);
                document.removeEventListener("mozfullscreenchange", this.mozResetCamera);
            }, this);
            this.goodsRequestViews = [];
        },

        new: function() {
            var form = new CreateMoverForm();
            form.on('hidden', form.close);
            form.render();
        },

        edit: function(e) {
            e.stopPropagation();
            var id = this.getID(e);

            var currentMover = webgnome.model.get('movers').get(id);
            var form = this.getForm(currentMover.get('obj_type'));
            var currentForm = new form(null, currentMover);

            currentForm.on('save', function() {
                currentForm.on('hidden', currentForm.close);
            });

            currentForm.on('wizardclose', currentForm.close);

            currentForm.render();
        },

        openMapModal: function(e) {
            if(!_.isUndefined(this.currentMap)){
                var element = this.currentMap.el;
                if(element.requestFullscreen) {
                    element.requestFullscreen();
                } else if(element.mozRequestFullScreen) {
                    element.mozRequestFullScreen();
                } else if(element.webkitRequestFullscreen) {
                    element.webkitRequestFullscreen();
                } else if(element.msRequestFullscreen) {
                    element.msRequestFullscreen();
                }
                document.addEventListener("mozfullscreenchange", this.mozResetCamera);
            }
        },

        resetCamera: function(e) {
            //timeout so transition to/from fullscreen can complete before recentering camera
            setTimeout(_.bind(function(){this._focusOnCurrent(this.displayedCurrent);}, this), 100);
        },

        _focusOnCurrent: function(cur) {
            if (_.isUndefined(this.currentMap)) {
                return;
            } else {
                cur.getBoundingRectangle().then(_.bind(function(rect) {
                    this.currentMap.viewer.scene.camera.flyTo({
                        destination: rect,
                        duration: 0
                    });
                    this.currentMap.viewer.scene.requestRender();
                }, this));
            }
        },

        cancelRequestHandler: function(currentTarget){
            var ct = $(currentTarget.target);
            var id = ct.parents('.goods-request-row').attr('data-id');
            var mod = webgnome.goodsRequests.findWhere({'request_id': id});
            mod.cancel();
        },
        
        pauseRequestHandler: function(currentTarget){
            var ct = $(currentTarget.target);
            var id = ct.parents('.goods-request-row').attr('data-id');
            var mod = webgnome.goodsRequests.findWhere({'request_id': id});
            mod._debugPause();
        },

        changeDisplayedCurrent: function(e) {
            this.currentPrims[this.displayedCurrent.get('id')].show = false;
            this.$('.cesium-map').hide();
            this.$('.loader').show();
            var curId = e.currentTarget.getAttribute('data-id');
            var cur = webgnome.model.get('movers').findWhere({'id': curId});
            if (cur) {
                this.displayedCurrent = cur;
                this._loadCurrent(cur).then(_.bind(function(){
                    this.$('.loader').hide();
                    var prim = this.currentPrims[cur.get('id')];
                    if (_.isUndefined(prim)){
                        console.error('Primitive for current '+ cur.get('name') + ' not found');
                        return;
                    }
                    prim.show = true;
                    this.$('.cesium-map').show();
                    this.resetCamera();
                }, this));
            }
        },

        render: function() {
            this.goodsRequestViews = [];
            clearInterval(this.requestInterval);
            for (var i = 0; i < webgnome.goodsRequests.models.length; i++) {
                var rq = webgnome.goodsRequests.models[i];
                var stateTest = rq.get('state') !== 'finished' || rq.get('state') !== 'dead';
                if (rq.get('request_type').includes(this.envtype) && stateTest){
                    var new_req = new GoodsRequestItemView({}, rq);
                    this.goodsRequestViews.push(new_req);
                    //add to current panel
                    this.$('.goods-request-list').append(new_req.$el);
                }
                if (rq.get('request_type').includes(this.envtype) && rq.get('state') === 'finished'){
                    rq.convertToMover().then(_.bind(rq.confirmConversion, rq));
                }
            }
            var unfinished = this.goodsRequestViews.filter(function(m){ return m.model.get('state')!=='finished' || m.model.get('state') !== 'dead';}).length > 0;
            if (this.goodsRequestViews.length > 0 && unfinished) {
                this.requestInterval = setInterval(webgnome.getGoodsRequests, 500, null, true);
            }
            var goodsRequestHTML = this.goodsRequestViews.map(function(r){
                r.render();
                return r.$el.html();
            });

            var currents = webgnome.model.get('movers').filter(_.bind(function(mover) {
                return this.models.indexOf(mover.get('obj_type')) !== -1;
            }, this));

            var currentsHTML = currents.map(_.bind(function(mover){
                return _.template(CurrentPanelItemTemplate)({current: mover});
            },this));

            var compiled = _.template(this.template)({
                currents: currentsHTML,
                goodsReqs: goodsRequestHTML
            });

            this.$el.html(compiled);
            if (currents.length > 0) {
                this.$el.removeClass('col-md-3').addClass('col-md-6');
                this.$('.panel-body').show({
                    duration: 10,
                    done: _.bind(function(){
                        if (!this.currentMap){
                            this.currentMap = CesiumView.getView(this.className);
                            this.currentMap.render();
                            var prims = this.currentMap.viewer.scene.primitives;
                            for (var i=0; i < prims._primitives.length; i++) {
                                if (_.isUndefined(this.currentPromises[prims._primitives[i].id])){
                                    prims.remove(prims._primitives[i]);
                                }
                            }
                            this.displayedCurrent = currents[0];
                            this._loadCurrent(currents[0]).then(_.bind(function() {
                                this.$('.loader').hide();
                                this.$(this.mapName).show();
                                this.resetCamera();
                            },this));
                        } 
                        this.$(this.mapName).append(this.currentMap.$el);
                        this.trigger('render');
                    }, this)
                });
            } else if (this.goodsRequestViews.length > 0){
                this.$el.removeClass('col-md-3').addClass('col-md-6');
                this.$('.panel-body').show();
                this.$('.map').hide();
            } else {
                this.current_extents = [];
                this.$el.removeClass('col-md-6').addClass('col-md-3');
                this.$('.panel-body').hide();
            }

            BasePanel.prototype.render.call(this);
        },

        _loadCurrent: function(current) {
            var cur_id = current.get('id');
            if (this.currentPromises[cur_id]) {
                return this.currentPromises[cur_id];
            } else {
                this.currentPromises[cur_id] = current.getGrid().then(_.bind(function(data){
                    var newPrim = current.processLines(data, false, this.currentMap.viewer.scene.primitives);
                    newPrim.id = cur_id;
                    newPrim.show = true;
                    this.currentPrims[cur_id] = newPrim;
                    console.log(newPrim.id);
                }, this));
                return this.currentPromises[cur_id];
            }
        },

        getForm: function(obj_type) {
            return _.has(this.forms, obj_type) ? this.forms[obj_type] : GridCurrentMoverForm;
        },

        delete: function(e) {
            e.stopPropagation();

            var id = this.getID(e);
            var spill = webgnome.model.get('movers').get(id);

            swal.fire({
                title: 'Delete "' + spill.get('name') + '"',
                text: 'Are you sure you want to delete this current?',
                icon: 'warning',
                confirmButtonText: 'Delete',
                confirmButtonColor: '#d9534f',
                showCancelButton: true
            }).then(_.bind(function(deleteCurrent) {
                if (deleteCurrent.isConfirmed) {
                    //Model changes
                    var mov = webgnome.model.get('movers').get(id);
                    var envs = webgnome.model.get('environment');

                    if (mov.get('obj_type') === 'gnome.movers.py_current_movers.CurrentMover') {
                        var env_id = mov.get('current').id;

                        for (var i = 0; i < envs.length; i++) {
                            if (envs.models [i].id === env_id) {
                                envs.remove(env_id);
                            }
                        }
                    }
                    webgnome.model.get('movers').remove(id);
                    webgnome.model.save(null, {
                        validate: false
                    });
                    //Cleanup map view
                    if(this.currentPromises[id]) {
                        delete this.currentPromises[id];
                    }
                    if (this.currentPrims[id]) {
                        this.currentMap.viewer.scene.primitives.remove(this.currentPrims[id]);
                        delete this.currentPrims[id];
                    }
                    this.currentMap = undefined;

                }
            }, this));
        },

        close: function() {
            if (this.currentMap) {
                this.currentMap.close();
            }
            if (this.requestInterval){
                clearInterval(this.requestInterval);
            }

            BasePanel.prototype.close.call(this);
        }

    });

    return currentPanel;
});

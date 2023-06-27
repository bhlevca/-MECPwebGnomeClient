define([
    'backbone',
    'underscore',
    'jquery',
    'cesium',
    'views/base',
    'text!templates/cesium/cesium.html',
    'model/visualization/graticule',
    'views/cesium/layers',
    'views/cesium/content_pane',
    'views/cesium/legend',
    'views/cesium/toolbox'
], function(Backbone, _, $, Cesium, BaseView, CesiumTemplate, Graticule,
            LayersView, ContentPaneView, LegendView, ToolboxView){
    var cesiumView = BaseView.extend({
        className: 'cesium-map',

        start_rectangle: Cesium.Rectangle.fromDegrees(-130, 25, -50, 50),
        world_rectangle: Cesium.Rectangle.fromDegrees(-180, -50, 100, 80),
        

        options: function() {
            return {
                animation: false,
                baseLayerPicker: false,
                vrButton: false,
                geocoder: false,
                fullscreenButton: false,
                homeButton: false,
                timeline: false,
                sceneModePicker: false,
                infoBox: false,
                selectionIndicator : false,
                targetFrameRate: 30,
                navigationHelpButton: false,
                navigationInstructionsInitiallyVisible: false,
                skyAtmosphere: false,
                sceneMode: Cesium.SceneMode.SCENE2D,
                mapProjection: new Cesium.WebMercatorProjection(),
                clockViewModel: new Cesium.ClockViewModel(new Cesium.Clock({
                   canAnimate: false,
                   shouldAnimate: false
                })),
                imageryProvider : new Cesium.OpenStreetMapImageryProvider(),
                selectedTerrainProviderViewModel : undefined,
                terrainProviderViewModels: [],
                contextOptions: {
                    webgl:{
                        preserveDrawingBuffer: false,
                    },
                },
                requestRenderMode: true,
                //Non-Cesium options below
                overlayStartsVisible: false,
                toolboxEnabled: true,
                toolboxOptions: {},
                layersEnabled: false,
                legendEnabled: false,
                graticuleEnabledOnInit: false,
                graticuleEnabledOnFullscreen: true,
            };
        },

        initialize: function(options){
            // See options attr above for list of options. 
            if (_.isUndefined(options)) {
                options = {};
            }
            BaseView.prototype.initialize.call(this, options);
            _.defaults(options, this.options());

            if (options.baseLayerPicker){
                options.imageryProviderViewModels = this.setupImageryProviderViewModels();
                options.selectedImageryProviderViewModel = options.imageryProviderViewModels[0];
                delete options.imageryProvider;
            }

            this.options = options;
            Cesium.BingMapsApi.defaultKey = 'Ai5E0iDKsjSUSXE9TvrdWXsQ3OJCVkh-qEck9iPsEt5Dao8Ug8nsQRBJ41RBlOXM';
            
            var tmpl = _.template(CesiumTemplate);
            this.$el.html(tmpl());
            this.viewer = new Cesium.Viewer(this.el, options);
            this.viewer.resolutionScale = Math.round(window.devicePixelRatio);
            this.viewer.scene.postProcessStages.fxaa.enabled = false;
            this.viewer.scene.highDynamicRange = false;
            this.viewer.scene.globe.enableLighting = false;
            this.viewer.scene.rethrowRenderErrors = true;
            this.viewer.entities.withLabelOpen = [];
            this.listenTo(this, 'requestRender', _.bind(function() {this.viewer.scene.requestRender();}, this));

            this.mouseHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            this.heldEnt = null;
            this.layerViews = [];
        },

        setupImageryProviderViewModels: function(opts){
            //Setup function for the baselayerpicker if it is enabled.
            var ipvms = [];
            ipvms.push(
                new Cesium.ProviderViewModel({
                    name : 'Open\u00adStreet\u00adMap',
                    iconUrl : Cesium.buildModuleUrl('Widgets/Images/ImageryProviders/openStreetMap.png'),
                    tooltip : 'OpenStreetMap (OSM) is a collaborative project to create a free editable map of the world.\nhttp://www.openstreetmap.org',
                    creationFunction : function() {
                        return new Cesium.OpenStreetMapImageryProvider({
                            url : 'https://a.tile.openstreetmap.org/'
                        });
                    }
                })
            );

/*             ipvms.push(
                new Cesium.ProviderViewModel({
                    name: 'NOAA Nav Charts',
                    tooltip: 'NOAA Nav Charts',
                    iconUrl: '/img/noaanavchartsiconsmall.png',
                    creationFunction: function(){
                        return new Cesium.ArcGisMapServerImageryProvider({
                            layers: '3',
                            tilingScheme: new Cesium.WebMercatorTilingScheme(),
                            //url: 'https://seamlessrnc.nauticalcharts.noaa.gov/arcgis/rest/services/RNC/NOAA_RNC/MapServer'
							url: 'https://gis.charttools.noaa.gov/arcgis/rest/services/MarineChart_Services/NOAACharts/MapServer'
                            //url: '//seamlessrnc.nauticalcharts.noaa.gov/arcgis/services/RNC/NOAA_RNC/ImageServer/WMSServer',
                        });
                    }
                })
            ); */

            ipvms.push(
                new Cesium.ProviderViewModel({
                    name : 'Bing Maps Aerial',
                    iconUrl : Cesium.buildModuleUrl('Widgets/Images/ImageryProviders/bingAerial.png'),
                    tooltip : 'Bing Maps aerial imagery',
                    creationFunction : function() {
                        return new Cesium.BingMapsImageryProvider({
                            layers: '1',
                            url : '//dev.virtualearth.net',
                            key : 'Ai5E0iDKsjSUSXE9TvrdWXsQ3OJCVkh-qEck9iPsEt5Dao8Ug8nsQRBJ41RBlOXM',
                            mapStyle : Cesium.BingMapsStyle.AERIAL_WITH_LABELS
                        });
                    }
                })
            );

            ipvms.push(
                new Cesium.ProviderViewModel({
                    name : 'No Imagery',
                    iconUrl : '',
                    tooltip : 'Blank (white) map',
                    creationFunction : function() {
                        return new Cesium.SingleTileImageryProvider({
                            url: '/img/globe.png'
                        });
                    }
                })
            );
            return ipvms;
        },

        render: function(){
            /*
            if (this.is_static) {
                this.viewer.scene.screenSpaceCameraController.enableRotate = false;
                this.viewer.scene.screenSpaceCameraController.enableTranslate = false;
                this.viewer.scene.screenSpaceCameraController.enableZoom = false;
                this.viewer.scene.screenSpaceCameraController.enableTilt = false;
                this.viewer.scene.screenSpaceCameraController.enableLook = false;
            }
            */
            //disable default focus on entity
            this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            //this.resetEntPickup(null); //attaches correct mouse handlers
            BaseView.prototype.render.call(this);
            this.overlay = this.$('.overlay');
            this.toolbox = this.$('.cesium-toolbox');
            var rightViews = [];
            var leftViews = [];
            if (this.options.toolboxEnabled) {
                this.toolbox = new ToolboxView(this.options.toolboxOptions, this);
                rightViews.push(this.toolbox);
                //this.leftPane = new ContentPaneView([this.toolbox,], {el:this.$('.left-content-pane')[0], side: 'left'});
            }
            if (this.options.layersEnabled || this.options.legendEnabled){
                if (this.options.legendEnabled) {
                    this.legend = new LegendView();
                    rightViews.push(this.legend);
                }
                if (this.options.layersEnabled){
                    this.layersPanel = new LayersView();
                    this.layersListeners();
                    rightViews.push(this.layersPanel);
                }
            }
            if (this.options.overlayStartsVisible) {
                this.overlay.show();
            } else {
                this.overlay.hide();
            }

            // equivalent to $( document ).ready(func(){})
            $(_.bind(function() {
                if(!this.layers){
                    this.layers = {};
                }
                this.listenTo(this, 'requestRender', this.requestRender);
                //$('.cesium-widget-credits').hide()
                this.graticuleContainer = this.$('.overlay-graticule')[0];
                this.graticule = new Graticule(this.viewer, this.graticuleContainer, false, 10, {});
                if (this.options.graticuleEnabledOnInit){
                    this.graticule.activate();
                } else {
                    this.graticule.deactivate();
                }
                this.viewer.scene.fog.enabled = false;
                this.viewer.scene.pickTranslucentDepth = true;
                if (this.options.layersEnabled || this.options.legendEnabled || this.options.toolboxEnabled){
                    this.rightPane = new ContentPaneView(rightViews, {el:this.$('.right-content-pane')[0]});
                    for (var i = 0; i < rightViews.length; i++) {
                        rightViews[i].render();
                    }
                }
                this._focusOn(this.start_rectangle);
            }, this));
        },

        requestRender: function() {
            this.viewer.scene.requestRender();
        },

        resetCamera: function(model) {
            //timeout so transition to/from fullscreen can complete before recentering camera
            setTimeout(_.bind(function(){this._focusOn(model);}, this), 100);
        },
/*
        addSpillListeners: function() {
            this.listenTo()
            //adds listeners to update this viewer when the model spill collection changes;
        },

        addActiveModelSpills: function() {
            //convenience function. also hooks up removal functions
            var spills = webgnome.model.get('spills').models;
            var spillDSs = [];
            for (var i = 0; i < spills.length; i++){
                if (spills[i].get('id')){
                    var billboardOpts = {billboard: {
                        image: '/img/spill-pin.png',
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                        color: Cesium.Color.YELLOW
                        }
                    };
                    var newDS = this.viewer.dataSources.add(spills[i].get('release').generateVis(billboardOpts));
                    this.listenToOnce(webgnome.model.get('spills'), 'remove:id:'+ spills[i].get('id'), this.genRemoveDSCallback(newDS), this);
                    spillDSs.push(newDS);
                }
            }
            return spillDSs;
        },
        
        genRemoveDSCallback: function(ds){
            //generates and returns a function that removes the specified DataSource from the viewer
            var retFunc = function(){
                this.viewer.dataSources.remove(ds);
            }
            return retFunc;
        },

        addMapPrimitives: function() {
            //convenience function to add map and cleanup function
            var map = webgnome.model.get('map');
            var prim;
            map.getGeoJSON().then(_.bind(function(data){
                prim = map.processMap(data, null, this.viewer.scene.primitives);
            }, this));
            prim.gnomeModel = map;
            this.listenToOnce(webgnome.model, 'change:map', this.genRemoveMapCallback(prim), this)
            return prim
        },
        
        genRemoveMapCallback: function(prim){
            //generates and returns a function that removes the specified DataSource from the viewer
            var retFunc = function(){
                if (this.viewer.scene.primitives.contains(prim)){
                    this.viewer.scene.primitives.remove(prim);
                } else {
                    console.error("Tried to remove missing map primitives from ", this)
                }
            }
            return retFunc;
        },
*/
        _focusOn: function(obj) {
            if (_.isUndefined(obj)){
                return;
            } else if (obj.getCesiumStartBox) {
                obj.getCesiumStartBox().then(_.bind(function(rect) {
                    this.viewer.scene.camera.flyTo({
                        destination: rect,
                        duration: 0
                    });
                    this.viewer.scene.requestRender();
                }, this));
            } else if (obj.getBoundingRectangle) {
                obj.getBoundingRectangle().then(_.bind(function(rect) {
                    this.viewer.scene.camera.flyTo({
                        destination: rect,
                        duration: 0
                    });
                    this.viewer.scene.requestRender();
                }, this));
            } else {
                this.viewer.scene.camera.flyTo({
                        destination: obj,
                        duration: 0
                    });
                this.viewer.scene.requestRender();
            }
        }
    });

    cesiumView.viewCache = {};

    //Because creating new Cesium Viewers is expensive, this function may be used to create them
    //and automatically cache/retrieve them for later use.
    cesiumView.getView = function(id, options, cache_opts) {
        if(_.isUndefined(cache_opts)) {
            cache_opts = {};
        }
        _.defaults(
            cache_opts,
            {'cache_save': true, //new view will be saved in the cache
             'cache_load': true, //attempt to load view id from cache before creating a new one
             'overwrite': false, //if not loading from cache, and cache_save is true, determines if an existing entry may be overwritten
             }
        );
        var v;
        if (cache_opts.cache_load) {
            v = cesiumView.viewCache[id];
            if (_.isUndefined(v)) {
                v = new cesiumView(options);
            }
        } else {
            v = new cesiumView(options);
        }

        if (cache_opts.cache_save) {
            if (!_.isUndefined(cesiumView.viewCache[id])) {
                if (cache_opts.overwrite) {
                    cesiumView.viewCache[id] = v;
                }
            } else {
                cesiumView.viewCache[id] = v;
            }
        }

        return v;
    };

    cesiumView._cleanup = function() {
        cesiumView.viewCache = {};
    };

    return cesiumView;
});
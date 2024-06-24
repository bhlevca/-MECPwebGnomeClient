define([
    'jquery',
    'underscore',
    'backbone',
    'module',
    'nucos',
    'views/modal/form',
    'views/form/concentration/map',
    'text!templates/form/concentration/concentration.html',
    'text!templates/panel/concentration-location-single.html',
    // 'model/concentration',
], function($, _, Backbone, module, nucos,
            FormModal, MapFormView, ConcentrationTemplate, ConcentrationLocationTemplate, ConcentrationModel) {
    'use strict';
    var waterForm = FormModal.extend({
        className: 'modal form-modal model-form water-form',
        title: 'Concentration Time-Series',

        events: function() {
            return _.defaults({
                'click .map-modal': 'initMapModal',
                'keyup .geo-info': 'manualMapInput'
            }, FormModal.prototype.events);
        },

        initialize: function(options, model) {
            this.module = module;
            FormModal.prototype.initialize.call(this, options);
            
            if (!_.isUndefined(model)) {
                this.model = model;
            }
            else {
                this.model = new ConcentrationModel();
            }
        },

        render: function(options) {
            this.body = _.template(ConcentrationTemplate)();

            FormModal.prototype.render.call(this, options);

            this.renderPositionInfo();
        },

        renderPositionInfo: function(e) {            
            var compiled;
        
            compiled = _.template(ConcentrationLocationTemplate)({
                    lat: this.model.get('locations')[0][1],
                    lon: this.model.get('locations')[0][0]
                });

            this.$('#positionInfo').html('');
            this.$('#positionInfo').html(compiled);
        },

        initMapModal: function() {
            this.mapModal = new MapFormView({size: 'xl'}, this.model);
            this.mapModal.render();

            this.mapModal.on('hidden', _.bind(function() {
                this.mapModal.close();
            }, this));

            this.mapModal.on('save', this.setManualFields, this);
        },

        setManualFields: function() {
            var startPoint = this.model.get('locations')[0];
            this.renderPositionInfo();
            this.clearError();

            this.$('#start-lat').val(startPoint[1]);
            this.$('#start-lon').val(startPoint[0]);
        },

        manualMapInput: function() {
            var start = [this.$('#start-lon').val(), this.$('#start-lat').val()];
            var startCoords = this.coordsParse(_.clone(start));
            var startPosition = [[startCoords[0], startCoords[1], 0]];

            this.model.set('locations', startPosition);

            this.showParsedCoords('start');
        },

        showParsedCoords: function(position) {
            var coords = this.model.get('locations');

            this.$('.' + position + '-lat-parse').text('(' + coords[0][1].toFixed(4) + ')');
            this.$('.' + position + '-lon-parse').text('(' + coords[0][0].toFixed(4) + ')');
        },

        coordsParse: function(coordsArray) {
            for (var i = 0; i < coordsArray.length; i++) {
                if (!_.isUndefined(coordsArray[i]) &&
                        coordsArray[i].trim().indexOf(' ') !== -1) {
                    coordsArray[i] = nucos.sexagesimal2decimal(coordsArray[i]);
                    coordsArray[i] = parseFloat(coordsArray[i]);
                }
                else if (!_.isUndefined(coordsArray[i])) {
                    coordsArray[i] = parseFloat(coordsArray[i]);
                }
            }

            return coordsArray;
        }
    });

    return waterForm;
});

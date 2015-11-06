define([
    'jquery',
    'underscore',
    'backbone',
    'views/modal/form',
    'text!templates/form/map/mapSelect.html'
], function($, _, Backbone, FormModal, SelectTemplate){
    'use strict';
    var mapTypeForm = FormModal.extend({
        title: 'Select Map Type',
        className: 'modal fade form-modal shorelinetype-form',

        events: function(){
            return _.defaults({
                'click .waterWorld': 'waterWorld',
                'click .parameterized': 'parameterized',
                'click .realLocation': 'realLocation'
            }, FormModal.prototype.events);
        },

        initialize: function(options){
            FormModal.prototype.initialize.call(this, options);
        },

        render: function(options){
            this.body = _.template(SelectTemplate);
            this.buttons = null;
            FormModal.prototype.render.call(this, options);
        },

        waterWorld: function(e){
            this.trigger('waterWorld');
        },

        parameterized: function(e){
            
        },

        realLocation: function(e){
            this.hide();
        }

    });
    return mapTypeForm;
});
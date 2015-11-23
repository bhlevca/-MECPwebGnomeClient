define([
    'jquery',
    'underscore',
    'backbone',
    'model/oil/library',
    'views/modal/form',
    'views/form/oil/specific',
    'text!templates/form/oilinfo.html'
], function($, _, Backbone, OilLib, FormModal, SpecificOilView, OilInfoTemplate){
    'use strict';
    var oilInfo = FormModal.extend({
       className: 'modal fade form-modal oil-info',
       name: 'oilinfo',
       title: 'Oil Information',
       size: 'lg',
       buttons: '<button type="button" class="back" data-dismiss="modal">Back</button>',

       events: function() {
          return _.defaults({
             'click .back': 'hide'
          }, FormModal.prototype.events);
       },

       initialize: function(options, substanceModel) {
          var containerClass = options.containerClass;
          this.on('ready', _.bind(function(){
             this.specificOilView = new SpecificOilView({infoMode: true, containerClass: containerClass, model: substanceModel});
          }, this));
          this.on('wizardclose', this.hide, this);
          this.render();
       },

       render: function(options) {
          this.body = _.template(OilInfoTemplate);
          FormModal.prototype.render.call(this, options);
       },

       hide: function() {
          this.on('hidden', this.close, this);
          FormModal.prototype.hide.call(this);
       }

    });

    return oilInfo;
});
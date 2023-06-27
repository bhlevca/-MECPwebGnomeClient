define([
    'underscore',
    'backbone',
    'model/visualization/envConditionsModel'
], function(_, Backbone, EnvConditionsModel){
    'use strict';
    var envConditionsCollection = Backbone.Collection.extend({
        model: EnvConditionsModel,
        url: '/goods/list_models',

        getBoundedList: function(model_map, request_type){
            return new Promise(_.bind(function(resolve, reject) {
                this.fetch(
                    {data: {
                        'map_bounds': JSON.stringify(model_map.get('map_bounds')),
                        'request_type': JSON.stringify(request_type),
                    },
                     success: _.bind(function(model, resp, options){
                         resolve(model);
                        },this),
                     error: reject
                    }
                );
            }, this));
        },
    });

    return envConditionsCollection;
});
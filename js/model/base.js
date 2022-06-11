define([
    'underscore',
    'backbone'
], function(_, Backbone){
    'use strict';
    var baseModel = Backbone.Model.extend({

        initialize: function(attrs, options){
            Backbone.Model.prototype.initialize.call(this, attrs, options);
            this.on('sync', this.rewindModel, this);
        },

        rewindModel: function(){
            if(!_.isUndefined(webgnome) && _.has(webgnome, 'cache')){
                webgnome.cache.rewind();
            }
        },

        parseObjType: function(){
            return this.get('obj_type').split('.').pop();
        },

        parse: function(response, options){
            //response = webgnome.parseSanitize(response);
            if (this === webgnome.model){
                //Special case stuff for the main model, specifically start time and duration
                //Hate making the exception here but it's used in so many other object inits
                //and time interval checking code.
                if (response.start_time){
                    this.set('start_time', response.start_time);
                }
                if (response.duration){
                    this.set('duration', response.duration);
                }
                if (response.time_step){
                    this.set('time_step', response.time_step);
                }
            }
            // model needs a special parse function to turn child objects into their appropriate models
            for(var key in this.model){
                if(response[key]){
                    var embeddedClass = this.model[key];
                    var embeddedData = response[key];

                    if(_.isArray(embeddedData)){
                        // maintain the existing collection but reset it so it doesn't
                        // keep objects from the default notation on the model
                        if(this.get(key)){
                            response[key] = this.get(key);
                        } else {
                            response[key] = new Backbone.Collection();
                        }
                        response[key].reset([], {silent: true});

                        if(!_.isObject(embeddedClass)){
                            // if the embedded class isn't an object it can only have one type of object in
                            // the given collection, so set it.
                            for(var obj in embeddedData){
                                response[key].add(this.setChild(embeddedClass, embeddedData[obj]), {merge: true});
                            }
                        } else {
                            // the embedded class is an object therefore we can assume
                            // that the collection can have several types of objects
                            // I.E. environment with wind and tide, figure out which one we have
                            // by looking at it's obj_type and cast it appropriatly.

                            for(var obj2 in embeddedData){
                                if(_.isFunction(embeddedClass[embeddedData[obj2].obj_type])){
                                    response[key].add(this.setChild(embeddedClass[embeddedData[obj2].obj_type], embeddedData[obj2]), {merge: true});
                                } else {
                                    response[key].add(this.setChild(Backbone.Model, embeddedData[obj2]), {merge: true});
                                }
                            }
                        }
                    } else if (_.isObject(embeddedClass) && !_.isFunction(embeddedClass)) {
                        response[key] = this.setChild(embeddedClass[embeddedData.obj_type], embeddedData);
                    } else {
                        // this is where the majority of all children are defined ex. spill's releaes and element_type object
                        response[key] = this.setChild(embeddedClass, embeddedData);
                    }
                }
            }
            this.trigger('fetched', this);
            return response;
        },


        // override default sync method to add a promise that will register objects with webgnome.obj_ref
        // if it's avilable and the object actually has an id.
        // 
        // This is needed because when creating an object and then adding it to the main model
        // to build a reference the original javascript object is lost and a new one is recreated with 
        // the old ones data.
        sync: function(method, model, options){
            var xhr = Backbone.Model.prototype.sync.call(this, method, model, options);
            
            xhr.always(function(){
                if(webgnome && webgnome.obj_ref && model.get('id')){
                    webgnome.obj_ref[model.get('id')] = model;
                }
            });
            return xhr;
        },

        setChild: function(Cls, data){
            if(!_.isUndefined(data) && _.has(webgnome.obj_ref, data.id)){
                var cached_obj = webgnome.obj_ref[data.id];
                return cached_obj.set(cached_obj.parse(data));
            }
            if(_.isUndefined(data)){
                data = {};
            }
            var obj = new Cls(data, {parse: true});
            webgnome.obj_ref[data.id] = obj;
            return obj;
        },

        // child change shouldn't be mapped directly to an event
        // rather it should be manually evoked through a mapped event
        // see gnome model for example.
        childChange: function(attr, child){
            if(!_.isObject(this.changed[attr])){
                this.changed[attr] = {};
            }
            this.changed[attr][child.get('id')] = child.changed;
            this.trigger('change', this);
        },
    });

    return baseModel;
});

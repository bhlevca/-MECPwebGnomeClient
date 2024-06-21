define([
    'underscore',
    'backbone',
    'model/base'
    //'model/initializers/windages'
], function(_, Backbone, BaseModel, Windage){
    'use strict';
    var gnomeSubstance = BaseModel.extend({
        urlRoot: '/substance/',

        model: {
            //initializers: Backbone.Collection
        },

        defaults: function() {
            return {
                "obj_type": "gnome.spills.gnome_oil.GnomeOil",
                "name": "Alaska North Slope",
                "windage_range": [0.01, 0.04],
                "windage_persist": 900,
                "is_weatherable": true,
                "standard_density": 864.8870390010605,
                "api": 32.03249189171683,
                "adios_oil_id": "EX00002",
                "pour_point": 223.661273,
                "solubility": 0.0,
                "bullwinkle_fraction": 0.1255688340191096,
                "original_bullwinkle_fraction": 0.1255688340191096,
                "bullwinkle_time": -999.0,
                "original_bullwinkle_time": -999.0,
                "emulsion_water_fraction_max": 0.9,
                "densities": [864.42],
                "density_ref_temps": [288.75],
                "density_weathering": [0.0],
                "kvis": [1.1083e-5, 6.419e-6, 5.1146e-6],
                "kvis_ref_temps": [293.15, 313.15, 323.15],
                "kvis_weathering": [0.0, 0.0, 0.0],
                "mass_fraction": [0.06562236, 0.00076390677, 0.057967156, 0.0030288481, 0.19790153, 0.028405363, 0.1006888, 0.028003759, 0.098763314, 0.040503044, 0.11947991, 0.07792793, 0.056078293, 0.028359439, 0.022775797, 0.06419608, 0.0095344639],
                "boiling_point": [288.0,288.0,331.5,331.5,418.0,418.0,523.0,523.0,606.5,606.5,725.0,725.0,875.0,875.0,1000.0,1000.0,1000.0],
                "molecular_weight": [63.694616, 54.266412, 81.464507, 70.584734, 124.85638, 111.0334, 195.66834, 178.56459, 271.53554, 252.86083, 425.8216, 410.50528, 782.8762, 820.51295, 1583.1776, 800.0, 1000.0],
                "component_density": [669.43295, 803.31954, 701.56961, 841.88353, 757.94033, 909.5284, 816.72682, 980.07219, 858.06435, 1029.6772, 910.6586, 1090.0, 969.56949, 1090.0, 1013.7003, 1100.0, 1100.0],
                "num_components": 17
            };
        },

        oilLibUrl: function(){
            if (this.get('adios_oil_id')){
                return webgnome.config.oil_api + '/gnome_oil/' + this.get('adios_oil_id');
            }
            else{
                return;
            }
            //return webgnome.config.oil_api + '/gnome_oil/' + this.get('adios_oil_id');
        },

        parseTemperatures: function(){
            //var flashPointK = this.get('flash_point');
            var pourPointK = this.get('pour_point');

            //var flashPointC = (flashPointK - 273.15).toFixed(1);
            //var flashPointF = ((flashPointC * (9 / 5)) + 32).toFixed(1);

            var pourPointC = (pourPointK - 273.15).toFixed(1);
            var pourPointF = ((pourPointC * (9 / 5)) + 32).toFixed(1);

           // if (flashPointK == null){
           //     flashPointC = '----';
           //     flashPointF = '----';
           // }

            return {
                    'pour_point_max_c': pourPointC,
                    'pour_point_max_f': pourPointF
                    //'flash_point_max_c': flashPointC,
                    //'flash_point_max_f': flashPointF
                   };
        },

        fetch: function(options) {
            if (_.isUndefined(options)){
                options = {};
            }
            options.url = this.oilLibUrl();
            return BaseModel.prototype.fetch.call(this, options);
        },

        validate: function(attrs, options){
            // if (_.isUndefined(attrs.bullwinkle_fraction)){
            //     return 'Stable emulsion fraction must be defined!';
            // }

            // if (_.isUndefined(attrs.emulsion_water_fraction_max)){
            //     return 'Emulsion constant must be defined!';
            // }
            
            // if (!_.isNumber(attrs.bullwinkle_fraction) || (attrs.bullwinkle_fraction < 0 || attrs.bullwinkle_fraction > 1)){
            //     return 'Stable emulsion fraction must be a number between zero and one!';
            // }

            // if (!_.isNumber(attrs.emulsion_water_fraction_max) || (attrs.emulsion_water_fraction_max < 0 || attrs.emulsion_water_fraction_max > 1)){
            //     return 'Emulsion constant must be a number between zero and one!';
            // }
        },

        parseCategories: function(){
            var cats = this.get('categories');
            var output = [];
            for(var c in cats){
                output.push(cats[c].parent.name + ' - ' + cats[c].name);
            }
            return output;
        }
    });
    return gnomeSubstance;
});
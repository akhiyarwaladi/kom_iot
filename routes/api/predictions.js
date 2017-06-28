var async = require('async'),
keystone = require('keystone');
var PythonShell = require('python-shell');
var Dataset = keystone.list('Dataset');
var timeseries = require("timeseries-analysis");

exports.get = function(req, res) {
	//get all post body parameter 
	data = (req.method == 'POST') ? req.body : req.query;
	//console.log(data.idnode)

	// Use python shell
	var pyshell = new PythonShell('predictMongo.py');
	// send parameter post to python script
	pyshell.send(data.idnode)
	pyshell.send(data.tipe)

	// begin chage data on message string
	pyshell.on('message', function (message) {
	    // received a message sent from the Python script (a simple "print" statement)
	    // split print in python by ,
	    var resi = message.split(",");
	    // pop last data because contain "\r", dont know how to handle
	    //resi.pop();
	    console.log(resi);

	    // make dictionary to story prediction data
		var dict = []; 

		for (var i = 0; i < (resi.length-3); i++) {
			dict.push({
				time: "default",
				senVal: resi[i]
			});
		}
	    //console.log(dict);
	   	// send response as api
		res.apiResponse({
			error: false,
			prediction: dict
		});

	});

	// end the input stream and allow the process to exit
	pyshell.end(function (err) {

	    if (err){
	        throw err;
	        res.apiResponse({
				error: true,
				message: "failed to predict data"
			});
	    };
	    //console.log('finished predict data');
	});

}

exports.gets = function(req, res) {
	data = (req.method == 'POST') ? req.body : req.query;

	Dataset.model.find({"sensornode": data.idnode}).limit(30).exec(function(err, item) {
		var dat = []
		var creat = []

		for (var i=0; i < (item.length); i++){
		    dat.push(item[i]["data"][data.tipe])
		    creat.push(item[i]["created_at"])
		}
		//console.log(dat);
		//console.log(creat);

		// var t     = new timeseries.main(timeseries.adapter.fromDB(item, {
		//     date:   'created_at',     // Name of the property containing the Date (must be compatible with new Date(date) )
		//     value:  ['data']["humidity"]     // Name of the property containign the value. here we'll use the "close" price.
		// }));
		// console.log(t)
		
		var t     = new timeseries.main(timeseries.adapter.fromArray(dat));
		//console.log(t)
 
		// We're going to forecast the 11th datapoint
		var forecastDatapoint	= dat.length+1;	
		//console.log(forecastDatapoint)
		 
		// We calculate the AR coefficients of the 10 previous points
		var coeffs = t.ARMaxEntropy({
		    data:	t.data
		});
		 
		// Output the coefficients to the console
		console.log(coeffs);
		 
		// Now, we calculate the forecasted value of that 11th datapoint using the AR coefficients:
		var forecast	= 0;	// Init the value at 0.
		dict = []
		for(var j=0; j<5; j++){
			for (var i=0; i<coeffs.length; i++) {	// Loop through the coefficients
			
			    forecast -= t.data[(dat.length-1-j)-i][1]*coeffs[i];

			    // Explanation for that line:
			    // t.data contains the current dataset, which is in the format [ [date, value], [date,value], ... ]
			    // For each coefficient, we substract from "forecast" the value of the "N - x" datapoint's value, multiplicated by the coefficient, where N is the last known datapoint value, and x is the coefficient's index.	
			}
			dict.push({
				time: "default",
				senVal: forecast
			});
			forecast = 0;
		}
		

		//console.log("forecast",forecast);

		res.apiResponse({
			error: false,
			prediction: dict
		});

	});
}
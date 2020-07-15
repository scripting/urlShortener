var myVersion = "0.5.2", myProductName = "urlShortener"; 

/*  The MIT License (MIT)
	Copyright (c) 2014-2020 Dave Winer
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	
	structured listing: http://scripting.com/listings/urlshortener.html
	*/

const fs = require ("fs");
const utils = require ("daveutils"); 
const davehttp = require ("davehttp");

var whenStart = new Date ();
var config = {
	port: process.env.PORT || 1421,
	flLogToConsole: true,
	flAllowAccessFromAnywhere: true,
	rootDomain: "localhost",
	createPath: "/create", //the path you use to create a new short URL
	domainsFolder: "domains/",
	homePagesFolder: "homePages/",
	};
var fnameConfig = "config.json";
var origAppModDate;
var lastCtHits;

var stats = {
	whenFirstStart: whenStart, ctStarts: 0,
	whenLastStart: undefined,
	ctWrites: 0,
	ctHits: 0, ctHitsToday: 0, ctHitsThisRun:0, 
	whenLastHit: new Date (0),
	domainMap: {},
	hitsByDomain: {}
	};
var fnameStats = "stats.json", flStatsChanged = false;

function statsChanged () {
	flStatsChanged = true;
	}
function fsSureFilePath (path, callback) { 
	var splits = path.split ("/");
	path = ""; //1/8/15 by DW
	if (splits.length > 0) {
		function doLevel (levelnum) {
			if (levelnum < (splits.length - 1)) {
				path += splits [levelnum] + "/";
				fs.exists (path, function (flExists) {
					if (flExists) {
						doLevel (levelnum + 1);
						}
					else {
						fs.mkdir (path, undefined, function () {
							doLevel (levelnum + 1);
							});
						}
					});
				}
			else {
				if (callback != undefined) {
					callback ();
					}
				}
			}
		doLevel (0);
		}
	else {
		if (callback != undefined) {
			callback ();
			}
		}
	}
function writeOneStaticFile (domain, key) {
	var templatestring = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><title></title><META HTTP-EQUIV="Refresh" CONTENT="0;URL=&lt;%longurl%&gt;"><meta name="robots" content="noindex"/><link rel="canonical" href="&lt;%longurl%&gt;"/></head><body></body></html>';
	var url = stats.domainMap [domain].map [key].url;
	var s = utils.replaceAll (templatestring, "&lt;%longurl%&gt;", url);
	var f = config.domainsFolder + domain + "." + config.rootDomain + "/" + key;
	fsSureFilePath (f, function () {
		fs.writeFile (f, s, function (err) {
			if (err) {
				console.log ("writeOneStaticFile: error creating file, f == " + f + ", err.message == " + err.message);
				}
			else {
				console.log ("writeOneStaticFile: created file, f == " + f);
				}
			});
		});
	}
function writeAllStaticFiles () {
	for (var domain in stats.domainMap) {
		var thisDomainMap = stats.domainMap [domain], folder = domain + "." + config.rootDomain;
		for (s in thisDomainMap.map) {
			var f = folder + s, url = thisDomainMap.map [s].url;
			writeOneStaticFile (domain, s);
			}
		}
	}
function findInDomainMap (domain, longUrl, callback) {
	if (stats.domainMap [domain] !== undefined) {
		var thisDomainMap = stats.domainMap [domain];
		for (var x in thisDomainMap.map) {
			var item = thisDomainMap.map [x];
			if (item.url == longUrl) { //match
				callback (item, x);
				return;
				}
			}
		}
	callback (undefined);
	}
function handleHttpRequest (theRequest) {
	const params = theRequest. params;
	const now = new Date ();
	
	function returnPlainText (s) {
		theRequest.httpReturn (200, "text/plain", s.toString ());
		}
	function returnData (jstruct) {
		if (jstruct === undefined) {
			jstruct = {};
			}
		theRequest.httpReturn (200, "application/json", utils.jsonStringify (jstruct));
		}
	function returnHtml (htmltext) {
		theRequest.httpReturn (200, "text/html", htmltext);
		}
	function returnXml (xmltext) {
		theRequest.httpReturn (200, "text/xml", xmltext);
		}
	function returnNotFound () {
		theRequest.httpReturn (404, "text/plain", "Not found.");
		}
	function returnError (jstruct) {
		theRequest.httpReturn (500, "application/json", utils.jsonStringify (jstruct));
		}
	function returnRedirect (url) {
		theRequest.httpReturn (302, "text/plain", "302 redirect", {location: url});
		}
	function httpReturn (err, jstruct) {
		if (err) {
			returnError (err);
			}
		else {
			returnData (jstruct);
			}
		}
	function createShortUrl (domain, longUrl, title, description) {
		var now = new Date ();
		
		if (stats.domainMap [domain] === undefined) {
			stats.domainMap [domain] = {
				nextstring: "0",
				map: {}
				};
			statsChanged ();
			}
		
		var thisDomainMap = stats.domainMap [domain];
		var thisString = thisDomainMap.nextstring;
		var jstruct = {
			url: longUrl,
			ct: 0,
			when: now
			};
		if (title != undefined) {
			jstruct.title = title;
			}
		if (description != undefined) {
			jstruct.description = description;
			}
		console.log ("createShortUrl: jstruct == " + utils.jsonStringify (jstruct));
		thisDomainMap.map [thisString] = jstruct;
		
		thisDomainMap.nextstring = utils.bumpUrlString (thisString);
		statsChanged ();
		writeOneStaticFile (domain, thisString); //12/19/15 by DW
		return ("http://" + domain + "." + config.rootDomain + "/" + thisString);
		}
	function returnDomain (domain) { //6/29/16 by DW
		var f = config.homePagesFolder + domain + "/index.html";
		fs.readFile (f, function (err, data) {
			if (err) {
				var thisDomainMap = stats.domainMap [domain];
				if (thisDomainMap === undefined) {
					const err = {
						message: "Can't return the domain contents because there is no " + domain + " domain."
						}
					returnError (err);
					}
				else {
					returnData (thisDomainMap)
					}
				}
			else {
				console.log ("returnDomain: f == " + f);
				returnHtml (data.toString ());
				}
			});
		}
	function refShortUrl (host, path) {
		var domain = utils.stringNthField (host, ".", 1);
		var thisDomainMap = stats.domainMap [domain];
		if (path == "/") {
			returnDomain (domain); //6/29/16 by DW
			}
		else {
			if (thisDomainMap === undefined) {
				returnNotFound ();
				}
			else {
				var thisUrl = thisDomainMap.map [utils.stringDelete (path, 1, 1)];
				if (thisUrl === undefined) {
					returnNotFound ();
					}
				else {
					thisUrl.ct++;
					statsChanged ();
					returnRedirect (thisUrl.url);
					}
				}
			}
		}
	
	//stats
		stats.ctHits++;
		stats.tHitsToday++;
		stats.ctHitsThisRun++;
		stats.whenLastHit = now;
		statsChanged ();
	
	switch (theRequest.lowerpath) {
		case config.createPath:
			findInDomainMap (params.domain, params.longUrl, function (item, key) {
				if (item !== undefined) {
					returnPlainText ("http://" + params.domain + "." + config.rootDomain + "/" + key);
					}
				else {
					returnPlainText (createShortUrl (params.domain, params.longUrl, params.title, params.description));    
					}
				});
			return;
		default:
			refShortUrl (theRequest.host, theRequest.lowerpath);
			return;
		}
	theRequest.httpReturn (404, "text/plain", "Not found.");
	}
function readConfig (f, theConfig, callback) { //7/14/20 by DW
	fs.readFile (f, function (err, jsontext) {
		if (!err) {
			try {
				var jstruct = JSON.parse (jsontext);
				for (var x in jstruct) {
					theConfig [x] = jstruct [x];
					}
				}
			catch (err) {
				console.log ("readConfig: err.message == " + err.message);
				}
			}
		else {
			console.log ("readConfig: err.message == " + err.message);
			}
		callback ();
		});
	}
function everyMinute () {
	var now = new Date ();
	if (now.getMinutes () == 0) {
		console.log ("\n" + now.toLocaleTimeString () + ": " + myProductName + " v" + myVersion + " running on port " + config.port + ".\n");
		}
	if (flStatsChanged) {
		stats.ctWrites++;
		flStatsChanged = false;
		fs.writeFile (fnameStats, utils.jsonStringify (stats), function () {
			});
		}
	}
function everySecond () {
	}
function startup () {
	readConfig (fnameConfig, config, function () {
		readConfig (fnameStats, stats, function () {
			stats.ctStarts++;
			stats.ctHitsThisRun = 0;
			stats.whenLastStart = whenStart;
			statsChanged ();
			console.log ("\n" + myProductName + " v" + myVersion + " running on port " + config.port + ".\n");
			console.log ("config == " + utils.jsonStringify (config)); 
			davehttp.start (config, handleHttpRequest);
			setInterval (everySecond, 1000); 
			setInterval (everyMinute, 60000); 
			});
		});
	}
startup ();

var myVersion = "0.40p", myProductName = "urlShortener"; 

/*  The MIT License (MIT)
	Copyright (c) 2014-2015 Dave Winer
	
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

var fs = require ("fs");
var urlpack = require ("url");
var http = require ("http");
var dns = require ("dns");
var utils = require ("./lib/utils.js"); 

var whenStart = new Date ();

var config = {
	myPort: 80,
	whenFirstStart: whenStart, ctStarts: 0,
	whenLastStart: undefined,
	ctWrites: 0,
	
	ctHits: 0, ctHitsToday: 0, ctHitsThisRun:0, 
	whenLastHit: new Date (0),
	
	rootDomain: "mydomain.com",
	flWatchAppDateChange: false,
	fnameApp: "server.js",
	createPath: "/" + utils.getRandomPassword (10), //the path you use to create a new short URL
	
	domainMap: {},
	hitsByDomain: {}
	};
var fnameConfig = "config.json", flConfigDirty = false;
var origAppModDate;
var lastCtHits;


function findInDomainMap (domain, longUrl, callback) {
	if (config.domainMap [domain] !== undefined) {
		var thisDomainMap = config.domainMap [domain];
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

function handleHttpRequest (httpRequest, httpResponse) {
	function return404 () {
		httpResponse.writeHead (404, {"Content-Type": "text/plain"});
		httpResponse.end ("File not found"); 
		}
	function httpReturn (val, type) { 
		if (type === undefined) {
			type = "text/plain";
			}
		httpResponse.writeHead (200, {"Content-Type": type, "Access-Control-Allow-Origin": "*"});
		httpResponse.end (val.toString ());    
		}
	function returnRedirect (url) {
		httpResponse.writeHead (302, {"location": url});
		httpResponse.end ("302 REDIRECT"); 
		}
	function createShortUrl (domain, longUrl, title, description) {
		var now = new Date ();
		
		if (config.domainMap [domain] === undefined) {
			config.domainMap [domain] = {
				nextstring: "0",
				map: {}
				};
			}
		
		var thisDomainMap = config.domainMap [domain];
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
		thisDomainMap.map [thisString] = jstruct;
		
		thisDomainMap.nextstring = utils.bumpUrlString (thisString);
		flConfigDirty = true;
		return ("http://" + domain + "." + config.rootDomain + "/" + thisString);
		}
	function refShortUrl (host, path) {
		var domain = utils.stringNthField (host, ".", 1);
		var thisDomainMap = config.domainMap [domain];
		if (thisDomainMap === undefined) {
			return404 ();
			}
		else {
			var thisUrl = thisDomainMap.map [utils.stringDelete (path, 1, 1)];
			if (thisUrl === undefined) {
				return404 ();
				}
			else {
				thisUrl.ct++;
				flConfigDirty = true;
				returnRedirect (thisUrl.url);
				}
			}
		}
	try {
		var parsedUrl = urlpack.parse (httpRequest.url, true), host, lowerhost, port, referrer;
		var lowerpath = parsedUrl.pathname.toLowerCase (), now = new Date ();
		//set host, port
			host = httpRequest.headers.host;
			if (utils.stringContains (host, ":")) {
				port = utils.stringNthField (host, ":", 2);
				host = utils.stringNthField (host, ":", 1);
				}
			else {
				port = 80;
				}
			lowerhost = host.toLowerCase ();
		//set referrer
			referrer = httpRequest.headers.referer;
			if (referrer == undefined) {
				referrer = "";
				}
			
		//stats
			//hits by domain
				if (config.hitsByDomain [lowerhost] == undefined) {
					config.hitsByDomain [lowerhost] = 1;
					}
				else {
					config.hitsByDomain [lowerhost]++;
					}
			//hits today
				if (!utils.sameDay (now, config.whenLastHit)) { //day rollover
					config.ctHitsToday = 0;
					}
			config.ctHits++;
			config.ctHitsToday++;
			config.ctHitsThisRun++;
			config.whenLastHit = now;
			flStatsDirty = true;
		
		//log the request
			dns.reverse (httpRequest.connection.remoteAddress, function (err, domains) {
				var client = httpRequest.connection.remoteAddress;
				if (!err) {
					if (domains.length > 0) {
						client = domains [0];
						}
					}
				if (client == undefined) { //1/25/15 by DW
					client = "";
					}
				console.log (now.toLocaleTimeString () + " " + httpRequest.method + " " + host + ":" + port + " " + lowerpath + " " + referrer + " " + client);
				});
		//handle the request
			if (lowerpath == config.createPath) {
				var domain = parsedUrl.query.domain, longUrl = parsedUrl.query.url;
				var title = parsedUrl.query.title, description = parsedUrl.query.description;
				if (domain === undefined) {
					throw {
						message: "Can't create the short url because the \"domain\" parameter is not provided."
						};
					}
				if (longUrl === undefined) {
					throw {
						message: "Can't create the short url because the \"url \"parameter is not provided."
						};
					}
				findInDomainMap (domain, longUrl, function (item, key) {
					if (item !== undefined) {
						httpReturn ("http://" + domain + "." + config.rootDomain + "/" + key);
						}
					else {
						httpReturn (createShortUrl (domain, longUrl, title, description));    
						}
					});
				}
			else {
				switch (lowerpath) {
					case "/version":
						httpResponse.writeHead (200, {"Content-Type": "text/plain"});
						httpResponse.end (myVersion);    
						break;
					case "/now": 
						httpResponse.writeHead (200, {"Content-Type": "text/plain"});
						httpResponse.end (now.toString ());    
						break;
					case "/status": 
						var savedPath = config.createPath;
						config.createPath = "";
						httpReturn (utils.jsonStringify (config));    
						config.createPath = savedPath;
						break;
					default:
						refShortUrl (host, parsedUrl.pathname);
						break;
					}
				}
		}
	catch (err) {
		httpResponse.writeHead (500, {"Content-Type": "text/plain"});
		httpResponse.end (err.message);    
		}
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
function writeStats (f, stats, callback) {
	fsSureFilePath (f, function () {
		fs.writeFile (f, utils.jsonStringify (stats), function (err) {
			if (err) {
				console.log ("writeStats: error == " + err.message);
				}
			if (callback != undefined) {
				callback ();
				}
			});
		});
	}
function readStats (f, stats, callback) {
	fsSureFilePath (f, function () {
		fs.exists (f, function (flExists) {
			if (flExists) {
				fs.readFile (f, function (err, data) {
					if (err) {
						console.log ("readStats: error reading file " + f + " == " + err.message)
						if (callback != undefined) {
							callback ();
							}
						}
					else {
						var storedStats = JSON.parse (data.toString ());
						for (var x in storedStats) {
							stats [x] = storedStats [x];
							}
						writeStats (f, stats, function () {
							if (callback != undefined) {
								callback ();
								}
							});
						}
					});
				}
			else {
				writeStats (f, stats, function () {
					if (callback != undefined) {
						callback ();
						}
					});
				}
			});
		});
	}

function everyMinute () {
	var now = new Date ();
	console.log ("\neveryMinute: " + now.toLocaleTimeString () + ", v" + myVersion + ", " + config.ctHitsThisRun + " hits");
	if (lastCtHits != config.ctHits) {
		flConfigDirty = true;
		}
	if (flConfigDirty) {
		flConfigDirty = false;
		config.ctWrites++;
		writeStats (fnameConfig, config, function () {
			writeStats (utils.getDatePath (new Date (), false) + ".json", config);
			});
		}
	}
function everySecond () {
	if (config.flWatchAppDateChange) { 
		utils.getFileModDate (config.fnameApp, function (theModDate) {
			if (theModDate != origAppModDate) {
				console.log ("everySecond: " + config.fnameApp + " has been updated. " + myProductName + " is quitting now.");
				process.exit (0);
				}
			});
		}
	}
function startup () {
	utils.getFileModDate (config.fnameApp, function (appModDate) { //set origAppModDate
		origAppModDate = appModDate;
		readStats (fnameConfig, config, function () {
			config.ctStarts++;
			config.ctHitsThisRun = 0;
			config.whenLastStart = whenStart;
			lastCtHits = config.ctHits;
			flConfigDirty = true;
			http.createServer (handleHttpRequest).listen (config.myPort);
			console.log (""); console.log (myProductName + " v" + myVersion + " running on port " + config.myPort + "."); console.log ("");
			setInterval (everySecond, 1000); 
			setInterval (everyMinute, 60000); 
			});
		});
	}
startup ();

// 
// Action on google to get the next flights to space
//
// @author: Ido Green | @greenido
// @date: Feb 2018
// @last update: Feb 2018
//
// @see:
// source for date: https://spaceflightnow.com/launch-schedule/
//
// https://github.com/greenido/bitcoin-info-action
// http://expressjs.com/en/starter/static-files.html
// http://docs.sequelizejs.com/manual/tutorial/models-definition.html#database-synchronization
// http://www.datejs.com/
//
// init project pkgs

const express = require('express');
const ApiAiAssistant = require('actions-on-google').ApiAiAssistant;
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const Map = require('es6-map');
const dateJS = require('./dateLib.js');


// Pretty JSON output for logs
const prettyjson = require('prettyjson');
const toSentence = require('underscore.string/toSentence');

app.use(bodyParser.json({type: 'application/json'}));
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

// Calling GA to make sure how many invocations we had on this skill
const GAurl = "https://ga-beacon.appspot.com/UA-65622529-1/flight-2-space-glitch-server/?pixel=0";
request.get(GAurl, (error, response, body) => {
  console.log(" - Called the GA - " + new Date());
});

// the max iterations we will do to find the next flight.
const MAX_FLIGHTS = 100;

//
// Handle webhook requests
//
app.post('/', function(req, res, next) {
  logObject("-- req: " , req);
  logObject("-- res: " , res);
  
  // Instantiate a new API.AI assistant object.
  const assistant = new ApiAiAssistant({request: req, response: res});
  let flightDate = assistant.getArgument('date');
  // Declare constants for your action and parameter names
  const KEYWORD_ACTION = 'when-next-flight'; 
  logObject('flightDate: ' , flightDate);
  
  //
  // trim words so we won't talk for more than 2 minutes.
  //
  function trimToWordsLimit(limit, text) {
    if (text == null) {
      return "";
    }
    
    var words = text.match(/\S+/g).length;
    var trimmed = text;
    if (words > limit) {
        // Split the string on first X words and rejoin on spaces
        trimmed = text.split(/\s+/, limit).join(" ");
    }
    return trimmed;
  }
  
  //
  // Clean the text we are getting from the API so it will work great with voice only
  //
  function getOnlyAsciiChars(str) {
    let cleanStr = str.replace(/[^\x00-\x7F]/g, "");
    cleanStr = cleanStr.replace(/\\u\w+/g, "");
    cleanStr = cleanStr.replace(/\\n/g, "");
    return cleanStr;
  }
  
  //
  // Coz wikipedia api return some data fields not inside tags :/
  //
  function cleanHTMLTags(html) {
    if (html != null && html.length > 1) {
      let text = html.replace(/<(?:.|\n)*?>/gm, '');
      let inx1 = 0;
      let foundDataField = text.indexOf("data-");
      while (inx1 < text.length && foundDataField > 0) {
        let inx2 = text.indexOf(">", inx1) + 1;
        if (inx2 < inx1) {
          inx2 = text.indexOf("\"", inx1) + 1;
          inx2 = text.indexOf("\"", inx2) + 2;
        }
        text = text.substring(0,inx1) + text.substring(inx2, text.length);
        inx1 = inx2 + 1;
        foundDataField = text.indexOf("data-", inx1);
      } 
      return text;  
    }
    //
    return html;
  }
  
  //
  // Create functions to handle intents here
  //
  function getNextFlightInfo(assistant) {
    let flightDateObj = null;
    if (flightDate != undefined && flightDate != null) {
      flightDateObj = Date.parse(flightDate);
    }
    console.log('** Handling action: ' + KEYWORD_ACTION + " date from user: " + flightDate + " Our calc date: " + flightDateObj);

    request({ method: 'GET',
             url:'https://spaceflightnow.com/launch-schedule/'},
            function (err, response, body) {
        if (err) {
            console.log("An error occurred. date: " + flightDate + " Err: " + JSON.stringify(err));
            assistant.tell("Sorry something is not working at the moment. Please try again laster.");
            return;
        }
        try {  
          let html = response.body; 
          let inx11 = html.indexOf('Latest changes:') + 10;
          html = html.substring(inx11);
          //console.log("== Raw text we got from API: " + JSON.stringify(html));
          let inx2 = html.indexOf('datename') + 8;
          let inx3 = html.indexOf('launchdate', inx2) + 12;
          let inx4 = html.indexOf('<', inx3) ;
          let launchDate = html.substring(inx3, inx4);
          launchDate = launchDate.replace('.', '');
          
          let launchDateVal = Date.parse(launchDate + " 2018");
          let curDate = Date.parse("today");
          if (flightDateObj != null) {
            curDate = flightDateObj;
          }
          
          console.log("== launchDate: " + launchDate + " | launchDateVal: " + launchDateVal + " curDate: " + curDate);
          let i = 1;
          while (launchDateVal.getTime() < curDate.getTime() && i < MAX_FLIGHTS) {
            // keep looking for the next launch
            //console.log(i + ") launchDateVal: " + launchDateVal + " curDate: " + curDate);
            inx2 = html.indexOf('datename', inx4) + 8;
            inx3 = html.indexOf('launchdate', inx2) + 12;
            inx4 = html.indexOf('<', inx3) ;
            launchDate = html.substring(inx3, inx4);
            launchDate = launchDate.replace('.', '');
            let inx55 = launchDate.indexOf('/');
            if (inx55 > 1) {
              launchDate = launchDate.substring(0, inx55);
            }
            launchDateVal = Date.parse(launchDate + " 2018");
            if (launchDateVal == null) {
              // so we could pass and move on to the next launch date
              launchDateVal = Date.parse("t - 2d");
            }
            //console.log(" NEW launchDateVal: " + launchDateVal);
            i++;
          }
          
          if (i >= MAX_FLIGHTS) {
            curDate = curDate.toLocaleDateString("en-US");
            assistant.ask("Could not find any launch that is plan after " + curDate + ". Do you wish to check another date?");
            return;
          }
          
          inx2 = html.indexOf('mission', inx4) + 9;
          inx3 = html.indexOf('<', inx2);
          let mission = html.substring(inx2, inx3);
 
          inx2 = html.indexOf('Launch time:', inx3) + 11;
          inx3 = html.indexOf('(', inx2) + 1;
          inx4 = html.indexOf(')', inx3);
          let LaunchTime = html.substring(inx3, inx4);
          
          inx2 = html.indexOf('site:', inx4) + 12;
          inx3 = html.indexOf('<', inx2);
          let site = html.substring(inx2, inx3);
          
          inx2 = html.indexOf('missdescrip', inx3) + 13;
          inx3 = html.indexOf('[', inx2);
          let desciption = html.substring(inx2, inx3);
          
          //console.log("== launchDate: " + launchDate + " mission: " + mission +  " LaunchTime: " + LaunchTime + " site: " + site + " desciption: " + desciption);
          // check if the user wish to know about certain date
          let afterDateStr = "";
          if (flightDateObj) {
            afterDateStr = " after " + flightDateObj.toLocaleDateString("en-US");
          }
          
          let res = "The next launch to sapce " + afterDateStr + " is at " + launchDate + " for " + mission + 
              " launch time is set to " + LaunchTime + " from " + site + 
              ". On that flight " + desciption + ". What other date do you wish to check?";
           // Using 'ask' and not 'tell' as we don't wish to finish the conversation
          assistant.ask(res);
        }
        catch(error) {
          console.log("(!) Error: " + error + " json: "+ JSON.stringify(error));
        }
    }); //
  }
  
  //
  // Add handler functions to the action router.
  //
  let actionRouter = new Map();
  actionRouter.set(KEYWORD_ACTION, getNextFlightInfo);
  
  // Route requests to the proper handler functions via the action router.
  assistant.handleRequest(actionRouter);
});

//
// Handle errors
//
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Oppss... could not check the western state results');
})

//
// Pretty print objects for logging
//
function logObject(message, object, options) {
  console.log(message);
  //console.log(prettyjson.render(object, options));
}


//
// Listen for requests -- Start the party
//
let server = app.listen(process.env.PORT, function () {
  console.log('--> Our Webhook is listening on ' + JSON.stringify(server.address()));
  
});
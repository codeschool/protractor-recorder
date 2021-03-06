/**
* Created by eduardo on 30/10/15.
*/
var express = require('express'),
 bodyParser = require('body-parser'),
 app        = express(),
 http       = require('http').Server(app),
 io         = require('socket.io')(http),
 fs         = require('fs'),
 request    = require('request'),
 exec       = require('child_process').exec;

var exportsDirectory = __dirname + '/public/exports';
var confFile         = exportsDirectory + '/conf.js';
var specFile         = exportsDirectory + '/spec.js';

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

io.on('connection', function(socket){

  //console.log(socket.id);
  //console.log(socket);

  console.log('a user connected');

  socket.on('onclick', function (data) {
    console.log('onclick');
    console.log(data);

    io.emit('click', data);

  });

  socket.on('onchange', function (data) {
    console.log('onchange');
    console.log(data);

    io.emit('change', data);

  });

  socket.on('onkeyup', function (data) {
  	console.log('onkeyup');
    console.log(data);

    io.emit('keyup', data);

  });

  socket.on('onfocus', function (data) {
  	console.log('onkeyup');
    console.log(data);

    io.emit('focus', data);

  });

  socket.on('onassertion', function (data) {
  	console.log('onassertion');
    console.log(data);

    io.emit('assertion', data);

  });

  socket.on('onunload', function (data) {
  	console.log('onunload');
    console.log(data);

    io.emit('unload', data);

  });

  socket.on('onmousemove', function (data) {
    console.log('onmousemove');
    console.log(data);

    io.emit('mousemove', data);

  });

  socket.on('disconnect', function(){
    console.log('user disconnected');

    io.emit('session-disconnect', 'session');
  });

  socket.on('execute', function(data){
    console.log('execute');
    io.emit('execute', data);
  });

});

app.get('/run', function(req, res){

  if (!fs.existsSync(confFile)){
    fs.mkdirSync(exportsDirectory);
  }

  var runProcess = exec('protractor ' + confFile);

  runProcess.stdout.on('data', function(data){
    console.log(data);
    io.emit('protractor-log', data);
  });
  runProcess.stderr.on('data', function(data){
    console.log(data);
    io.emit('protractor-log', data);
  });
  var message = 'Running protractor ' + confFile;
  console.log(message);
  res.send(message);
});

app.get('/webdriver-manager/:command', function(req, res){

  var command = req.params.command;

  exec('webdriver-manager ' + command, function(error, stdout, stderr) {

    var stdout = stdout.split('\n');

    var drivers = [{driver: 'firefox'}];
    stdout.forEach(function(driver){
      if(driver.match(/versions available/i) && driver.match(/chrome|firefox|ie/i))
          drivers.push({driver: driver.match(/(\w+)/)[0]});
    });

    res.send(drivers);

  });

});

app.post('/html', function(req, res){

  var url = req.body.url;
  var include = req.body.include;

  request({
    uri: url + '/' + include
  }, function(error, response, body) {
    res.send(body);
  });

});

app.post('/export', function(req, res){

  if (!fs.existsSync(exportsDirectory)){
    fs.mkdirSync(exportsDirectory);
  }

  var conf     = JSON.parse(req.body.conf);
  var describe = JSON.parse(req.body.describe);
  var baseUrl  = req.body.baseUrl;
  //var onPrepare = JSON.parse(req.body.onPrepare);

  var confOutput = "exports.config = {\r\n";

  if(conf.jasmine)
    confOutput += "  framework: 'jasmine2',\r\n";

  confOutput += "  seleniumAddress: '" + conf.seleniumAddress + "',\r\n" +
             "  baseUrl: '" + baseUrl + "',\r\n" +
             "  specs: ['spec.js'],\r\n";

  if(conf.capabilities.length == 1) {

    if(conf.capabilities[0] === 'chromedriver')
      conf.capabilities[0] = 'chrome';

    confOutput += "  capabilities: {browserName: '" + conf.capabilities[0] + "'},\r\n";
  } else {
    confOutput += "  multiCapabilities: [";
    conf.capabilities.forEach(function(capability){

      if(capability === 'chromedriver')
        capability = 'chrome';

      confOutput += "{browserName: '" + capability + "'}, ";
    });
    confOutput += "],\r\n";
  }

  confOutput += "  onPrepare: function(){\r\n";

  if(conf.ignoreSynchronization)
    confOutput += "    browser.ignoreSynchronization = true;\r\n";

  if(conf.maximize)
    confOutput += "    browser.driver.manage().window().maximize();\r\n";

  confOutput += "    browser.driver.get('" + baseUrl +"');\r\n";

  if(conf.spec.lines){
    conf.spec.lines.forEach(function(line){

      confOutput += '    ' + line + '\r\n';

    });
  }

  if(conf.login)
    confOutput += "    return browser.driver.wait(function() {\r\n" +
        "      return browser.driver.getCurrentUrl().then(function(url) {\r\n" +
        "        return url != '" + baseUrl + "';});\r\n" +
        "    }, 10000, 'Error');\r\n";

  confOutput += "  }\r\n}";

  // Update conf.js to run with protractor
  fs.writeFile(confFile, confOutput, function(err) {
    if(err) {
      res.status(500).send(err);
      console.log(err);
    }
    console.log('Conf.js saved successfully!');
  });

  var output = "describe('" + describe[0].string + "', function(){\r\n\r\n";

  describe[0].specs.forEach(function(spec){
    output += "  it('" + spec.string + "', function(){\r\n\r\n";

    if(spec.lines){
      spec.lines.forEach(function(line, index){

        if(line.slice(-1) == ';') {
          if(index == 0)
            output += '    ' + line + '\r\n    ';
          else
            output += line + '\r\n    ';
        } else {
          output += line;
        }

        /*if(lastAction != null && lastAction.locator && lastAction.locator.type == 'repeater') {

          output += line + ';\r\n';

        } else {

          if (action.locator.type == 'repeater')
            output += '    ' + line + '.';
          else
            output += '    ' + line + ';\r\n';
        }

        lastAction = action;*/

      });
    }

    output += '\r\n  });\r\n\r\n';
  });

  output += '});\r\n';

  //console.log(output);

  // Update spec to run with protractor
  fs.writeFile(specFile, output, function(err) {
    if(err) {
      res.status(500).send(err);
      console.log(err);
    }
    console.log('Spec.js saved successfully!');
    var message = 'Files exported to ' + exportsDirectory;
    console.log(message);
    res.send(message);
  });


});

http.listen(9000, function () {
 console.log('Server listening on *:9000');

  /*var webdriver = exec('webdriver-manager start');

  webdriver.stdout.on('data', function(data){
    console.log('webdriver-manager start');
  });*/

});

(function () {
  'use strict';

  angular
  .module('protractorRec')
  .controller('NavbarController', NavbarController);

  /** @ngInject */
  function NavbarController($scope, $log, $location, $filter, $mdToast, $document, $routeParams, socket, protractorRecServer, seleniumJWP) {

    var vm = this;

    /*-------------------------------------------------------------------
     *              ATTRIBUTES
     *-------------------------------------------------------------------*/

    vm.isLoadingSession    = false;
    vm.showConf            = $location.path() == '/conf' ? true : false;
    vm.isSnippet           = false;
    vm.showSelectedOptions = false;
    vm.index = false;

    vm.capabilities  = [];

    vm.url       = localStorage.getItem('url') ? localStorage.getItem('url') : 'http://www.protractortest.org';
    vm.conf      = localStorage.getItem('conf') ? angular.fromJson(localStorage.getItem('conf')) : false;
    vm.describes = localStorage.getItem('describes') ? angular.fromJson(localStorage.getItem('describes')) : [];
    vm.session   = localStorage.getItem('session') ? angular.fromJson(localStorage.getItem('session')) : {};

    /**
     * Javascript snippet to inject on session
     */
    vm.snippet = 'if(!document.getElementById("recorder-iframe")){' +
      'var b=document.getElementsByTagName("body")[0];' +
      'var i=document.createElement("iframe");' +
      'i.id="recorder-iframe";' +
      'i.setAttribute("style", "display:none");' +
      'b.appendChild(i);' +
      'var i = document.getElementById("recorder-iframe");' +
      'var s = i.contentWindow.document.createElement("script");' +
      's.onload=function(){' +
        'var s = i.contentWindow.document.createElement("script");' +
        's.src = "http://localhost:9000/snippet.js";' +
        'i.contentWindow.document.body.appendChild(s);' +
      '},s.src = "http://localhost:9000/socket.io-1.3.7.js",i.contentWindow.document.body.appendChild(s);}';

    vm.lines         = [];
    vm.describe      = {};
    vm.spec          = [];
    vm.dataBind      = [];

    vm.selectedItems = 0;

    /* Configuration example */
    if(!vm.conf) {
      vm.conf = {
        isRecording: false,
        string: 'Conf.js',
        seleniumAddress: 'http://localhost:4444/wd/hub',
        capabilities: ['chromedriver'],
        spec: {
          actions: [
          {type: 'link', value: vm.url, action: 'get'}
          ]
        }

      };
    }

    /*-------------------------------------------------------------------
     *              SOCKET ON
     *-------------------------------------------------------------------*/
    /**
     * Messages: onsnippet, click, change, keyup, assertion, session-disconnect, protractor-log
     */

    socket.on('onsnippet', function(){
       vm.isSnippet = true;
    });

    socket.on('click', function (data) {
      $log.debug('onclick');
      $log.debug(data);

      vm.setElement(data);

    });

    socket.on('change', function (data) {
      $log.debug('onchange');
      $log.debug(data);

      vm.setElementOnChange(data);

    });

    socket.on('keyup', function (data) {
      $log.debug('onkeyup');
      $log.debug(data);

      if(vm.conf.isRecording) {
        var lastAction = vm.spec.actions[vm.spec.actions.length - 1];
        lastAction.action = 'sendKeys';
        lastAction.value = data;
      }

    });

    socket.on('assertion', function (data) {
      $log.debug('onassertion');
      $log.debug(data);

      if(vm.conf.isRecording && data) {
        var lastAction = vm.spec.actions[vm.spec.actions.length - 1];

        lastAction.action = 'assertion';
        lastAction.value = data.trim();

        vm.dataBind.forEach(function (data) {
          lastAction.locators.push(data);
        });
      }
    });

    socket.on('session-disconnect', function (data) {

      seleniumJWP.getSessionUrl().success(function(response){

        if(vm.session.url != response.value && !vm.isSnippet) {
          vm.isLoadingSession = true;
          vm.getSessionSource();
        }
        vm.session.url = response.value;
      });

      $log.debug('on-session-disconnect');
      $log.debug(data);

    });

    socket.on('protractor-log', function (data) {
      $log.debug('protractor-log');
      $log.debug(data);
    });

    vm.openConf = function() {
      $location.url('/conf');
    };

    vm.setElement = function (element) {

      if(vm.conf.isRecording) {
        var target = angular.element(element.outerHTML);
        var parent = !element.offsetParent.outerHTML ? [] : angular.element(element.offsetParent.outerHTML);

        var value = '';

        if (target[0].tagName.match(/^button/i) || (parent[0].tagName && parent[0].tagName.match(/^button/i)) && !target[0].tagName.match(/^input/i)) {

          vm.addElement(parent, 'button', 'click', target.text().trim(), element.xPath);

        } else if (target[0].tagName.match(/^input/i)) {
          vm.addElement(target, 'input', 'click', false, element.xPath);
        } else if (target[0].tagName.match(/^a/i)) {
          vm.addElement(target, 'a', 'click', target.text().trim(), element.xPath);
        } else if (element.ngRepeat) {

          value = target.text() ? target.text() : false;

          //if(value)
          vm.addElement(target, target[0].tagName.toLowerCase(), 'wait', value.trim(), element.xPath);

          vm.addElement(target, 'row', 'click', element.ngRepeat.rowIndex, element.xPath, element.ngRepeat.value);

          vm.addElement(target, target[0].tagName.toLowerCase(), 'click', value.trim(), element.xPath);

        } else if(!target[0].tagName.match(/^select/i)){
          value = target.text() ? target.text().trim() : false;
          vm.addElement(target, target[0].tagName.toLowerCase(), 'click', value, element.xPath);
        }
      }
    };

    vm.addElement = function (element, type, actionType, value, xPath, repeater) {

      var locators = [];

      if(type == 'select' && vm.getAttr('ng-model', element))
        locators.push({type: 'model', value: vm.getAttr('ng-model', element)});

      if(type == 'row')
        locators.push({type: 'repeater', value: repeater});

      if (type == 'button' && value)
        locators.push({type: 'buttonText', value: value});

      if (type == 'input' && vm.getAttr('ng-model', element))
        locators.push({type: 'model', value: vm.getAttr('ng-model', element)});

      if (type == 'input' && vm.getAttr('name', element))
        locators.push({type: 'css', value: '[name="' + vm.getAttr('name', element) + '"]', strategy: 'css selector'});

      /*if (type == 'input' && vm.getAttr('type', element) == 'button') {
        locators.push({type: 'id', value: vm.getAttr('id', element)});
      }*/

      if (type == 'input' && vm.getAttr('type', element) == 'submit')
        locators.push({type: 'css', value: '[value="' + element.val() + '"]', strategy: 'css selector'});

      if (vm.getAttr('href', element)) {
        locators.push({type: 'linkText', value: value, strategy: 'link text'});
        locators.push({type: 'get', value: vm.getAttr('href', element)});
      }

      if (vm.getAttr('id', element) && !element[0].tagName.match(/md/i))
        locators.push({type: 'id', value: vm.getAttr('id', element), strategy: 'id'});

      //if (vm.getAttr('class', element) || actionType == 'wait') {

        if (value && type != 'row')
          locators.push({type: 'xpath', value: '//' + type + '[.="' + value + '"]', strategy: 'xpath'});

        if (xPath && !vm.getAttr('ng-click', element) && !vm.getAttr('class', element))
          locators.push({type: 'xpath', value: xPath, strategy: 'xpath'});

        if (vm.getAttr('ng-click', element))
          locators.push({type: 'css', value: '[ng-click="' + vm.getAttr('ng-click', element) + '"]', strategy: 'css selector'})

        if (xPath)
          locators.push({type: 'xpath', value: xPath, strategy: 'xpath'});

        if(vm.getAttr('class', element))
          locators.push({type: 'css', value: '.' + vm.getAttr('class', element).replace(/\s/g, '.')});
      //}

      var action = {
        //element: element.html(),
        type: type,
        value: value,
        action: actionType,
        locators: locators,
        locator: locators ? {type: locators[0].type, value: locators[0].value} : null
      };

      vm.spec.actions.push(action);

      var mainContent = angular.element( $document[0].querySelector('#main') );
      mainContent[0].scrollTop = mainContent[0].scrollHeight;

      vm.getSessionUrl();

      //localStorage.setItem('actions', angular.toJson(vm.actions));

      //vm.getSessionUrl();

    };

    vm.verifySnippet = function(){

      var countIframe = vm.session.source.match(/recorder-iframe/);
      countIframe != null ? countIframe.length : countIframe = 0;

      if (!vm.isSnippet && countIframe == 0) {
        vm.sessionExecute();
      } else {
        vm.isLoadingSession = false;
      }
    };

    /**
     * Get all html from ng-includes and concatenate with main source
     */
    vm.getNgIncludes = function () {

      $log.debug('getNgIncludes');

      var ngIncludes = vm.session.source.match(/ngInclude:\s?["|'](.*?)["|']/igm);

      $log.debug(ngIncludes);

      var includes = [];

      angular.forEach(ngIncludes, function (include) {

        include = include.replace(/:\s|\"|\'|ngInclude|{{|}}/g, '').trim();

        if (!$filter('filter')(includes, include).length) {

          protractorRecServer.getHtmlSource({url: vm.url, include: include}).success(function(response){
            vm.session.source += response;
            vm.getAllDataBind();
          });
        }
        includes.push(include);
      });
    };

    vm.getSessionSource = function () {

      if (vm.session.id) {
        seleniumJWP.getSessionSource().success(function(response) {
          vm.session.source = response.value;
          if(response.value) {
            vm.getNgIncludes();
            vm.verifySnippet();
          }
        }).error(function(response){
          $log.debug(response);
          $log.debug('Error session source');
          vm.deleteSession();
        });
      } else {
        vm.isLoadingSession = false;
        vm.conf.isRecording = false;
      }
    };

    vm.setSessionUrl = function () {
      seleniumJWP.setSessionUrl(vm.url).success(function(){
        $log.debug('setSessionUrl');
        vm.getSessionUrl();
        vm.getSessionSource();
      });
    };

    vm.getSessionUrl = function () {
      seleniumJWP.getSessionUrl().success(function(response){
        $log.debug('getSessionUrl');
        vm.session.url = response.value;
      });
    };

    vm.runTest = function () {

      $log.debug('runTest');

      protractorRecServer.runProtractor().success(function(response){
        $log.debug('Test finished');
        $log.debug(response);
      });
    };

    vm.exportProtractor = function () {

      $log.debug('exportProtractor');

      /* Get line to export actions in conf.js */
      vm.conf.spec.lines = [];

      angular.forEach(vm.conf.spec.actions, function (action) {

        if(action.breakpoint) {
          vm.conf.spec.lines('    browser.pause();');
        }

        vm.conf.spec.lines.push(vm.getLine(action));

      });

      /* Get line to export actions in spec.js */
      vm.spec.lines = [];

      if($filter('filter')(vm.spec.actions, {action: 'wait'}).length != 0)
        vm.spec.lines.push('    var EC = protractor.ExpectedConditions;');

      angular.forEach(vm.spec.actions, function (action) {

        if(action.breakpoint) {
          vm.spec.lines.push('browser.pause();');
        }

        vm.spec.lines.push(vm.getLine(action));

      });

      var data = {baseUrl: vm.url, conf: angular.toJson(vm.conf), describe: angular.toJson(vm.describes)};

      protractorRecServer.exportProtractor(data).success(function(response){
        $log.debug('Exported');
        $log.debug(response);

        $mdToast.show(
          $mdToast.simple()
          .content('File exported!')
          .position('bottom left')
          .hideDelay(3000)
          );
      });
    };

    vm.createSession = function () {

      if(!vm.session.id) {

        vm.isLoadingSession = true;
        var options = {'desiredCapabilities': {'browserName': 'chrome', acceptSSlCerts: true}};

        seleniumJWP.newSession(options).success(function(response){
          $log.debug('Session Created');
          seleniumJWP.setSession(response);
          vm.session.id = response.sessionId;
          vm.conf.isRecording = true;
          vm.setSessionUrl();

        });

      } else {
        vm.conf.isRecording = true;
      }
    };

    vm.pauseRecording = function(){
      vm.conf.isRecording = false;
    };

    $scope.$watch('navbar.conf', function () {
      $log.debug('watch conf');
      localStorage.setItem('conf', angular.toJson(vm.conf));
    }, true);

    $scope.$watch('navbar.describe', function () {
      $log.debug('watch describe');
      localStorage.setItem('describes', angular.toJson(vm.describes));

    }, true);

    $scope.$watchCollection('navbar.describes', function () {
      $log.debug('watch describes');
      localStorage.setItem('describes', angular.toJson(vm.describes));
    });

    $scope.$watch('navbar.session', function () {
      $log.debug('watch session');
      localStorage.setItem('session', angular.toJson(vm.session));
    }, true);

    vm.setSpec = function (spec, index) {

      $log.debug($routeParams);

      $log.debug('setSpec');
      if(vm.showConf && index == undefined) {
        vm.showConf = true;
        vm.spec = vm.conf.spec;
        $location.path('/conf');
      } else {
        vm.spec = spec;
        vm.showConf = false;

        if($routeParams.id){
          index = $routeParams.id;
        }



        $location.path('/spec/' + index);
      }

      angular.forEach(vm.spec.actions, function(action) {
        action.checked = false;
      });
    };

    /**
     * Get all data bind to suggest on assertions
     */
    vm.getAllDataBind = function () {

      $log.debug('getAllDataBind');

      var dataBind = vm.session.source.match(/\{{2}(.*?)\}{2}|ng-bind=["|'](.*?)["|']/igm);

      angular.forEach(dataBind, function (data) {

        data = data.replace(/\"|\'|ng-bind=|{{|}}/g, '').trim();

        if (!$filter('filter')(vm.dataBind, data).length) {

          vm.dataBind.push({type: 'bind', value: data});

        }

      });

      $log.debug(dataBind);
      $log.debug(vm.dataBind);

    };

    vm.sessionExecute = function () {

      seleniumJWP.sessionExecute(vm.snippet).success(function() {
        $log.debug('Session Executed');


        if (!vm.isSnippet) {
          $mdToast.show(
              $mdToast.simple()
                  .content('Session ready to record!')
                  .position('bottom left')
                  .hideDelay(3000)
          );
        }

        vm.isLoadingSession = false;
        vm.isSnippet = true;
        vm.getSessionUrl();
      });

    };

    vm.getAttr = function (attr, elem) {
      if (elem.attr(attr))
        return elem.attr(attr);
      return false;
    };

    vm.getCapabilities = function(){
      $log.debug('getCapabilities');
      protractorRecServer.getCapabilities().success(function(response){
        vm.capabilities = response;
        vm.capabilities.forEach(function(capability){
          if(!vm.conf.capabilities.indexOf(capability.driver)){
            capability.checked = true;
          }
        });
      }).error(function(message){
        $log.debug(message);
      });
    };

    vm.getCapabilities();
    vm.getSessionSource();
  }
})();
(function() {
  'use strict';

  angular
    .module('protractorRec')
    .config(routeConfig);

  function routeConfig($routeProvider) {
    $routeProvider
      .when('/conf', {
        templateUrl: 'app/main/conf.html',
        controller: 'MainController',
        controllerAs: 'main'
      })
      .when('/spec/:id', {
        templateUrl: 'app/main/spec.html',
        controller: 'MainController',
        controllerAs: 'main'
      })
      .otherwise({
        redirectTo: '/conf'
      });
  }

})();

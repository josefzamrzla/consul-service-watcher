# Consul service watcher

Service registry watcher

### Sample usage

Get list of 'a-service' services, every 1 second. No matter if services are healthy or failing.

```javascript
var ServiceWatcher = require('./');
watcher = new ServiceWatcher('localhost', 8500, 'a-service', {
    passingOnly: false, 
    updateInterval: 1000, 
    serviceTag: null
});

watcher.on('error', function (e) {
    console.error(e);
});

watcher.on('warn', function (warn) {
    console.warn(warn);
});

// logs a list of services that is being emitted every 1 second
watcher.on('services', function (services) {
    console.log(services);
});
```

### Service configuration

Watcher looks for service configuration data in Consul key-value store under key: "service/[service name]/[service id]/". 
If found, configuration data are appended to a service JSON, under key "Data". 

### TODO

docs :-)
var util = require('util'),
    events = require('events'),
    consul = require('consul');

var ServiceWatcher = function (consulHost, consulPort, serviceName, options) {
    var self = this;
    options = options || {};
    options.passingOnly = options.passingOnly || false;
    options.serviceTag = options.serviceTag || null;
    this.updateInterval = options.updateInterval || 10000; // 10 seconds by default

    this.consul = consul({host: consulHost, port: consulPort});

    this.serviceOptions = {
        service: serviceName,
        passing: options.passingOnly
    };

    if (options.serviceTag) {
        this.serviceOptions['tag'] = options.serviceTag;
    }

    process.nextTick(function () {
        self.update();
    });
};
util.inherits(ServiceWatcher, events.EventEmitter);

ServiceWatcher.prototype.update = function () {
    var self = this;

    this.consul.health.service(this.serviceOptions, function(err, healthyServices) {
        if (err) {
            self.emit('error', err);
        }
        else if (!healthyServices) {
            self.emit('warn', 'Cannot get list of services. Empty result.');
        } else {

            var serviceMap = {};
            healthyServices.forEach(function (node, position) {
                node['Service']['Data'] = {};
                serviceMap[node['Service']['ID']] = position;
            });

            var confs = {};
            var keyspace = 'service/' + self.serviceOptions.service;
            self.consul.kv.get({key: keyspace, recurse: true}, function(err, confItems) {

                if (err) {
                    err.message = 'Cannot get service configuration items. ' + err.message;
                    self.emit('error', err);
                } else if (confItems && confItems.length) {
                    confItems.forEach(function (item) {
                        if (!('Value' in item && item.Value !== null)) return;

                        var keys = item['Key'].replace(keyspace + '/', '').split('/');
                        confs[keys[0]] = confs[keys[0]] || {};
                        confs[keys[0]][keys[1]] = item.Value;
                    });

                    Object.keys(confs).forEach(function (confKey) {
                        if (confKey in serviceMap) {
                            healthyServices[serviceMap[confKey]]['Service']['Data'] = confs[confKey];
                        }
                    });
                }

                var list = {};
                healthyServices.forEach(function (node) {
                    if (node['Service'] && node['Service']['ID']) {

                        node['Service']['Status'] = node['Checks'].filter(function (check) {
                            return check['Status'] != 'passing';
                        }).length > 0? 'failing' : 'passing';

                        ((node['Service']['Tags'] && node['Service']['Tags'].length)? node['Service']['Tags']:['default']).forEach(function (tag) {
                            // init list if not present
                            list[tag] = list[tag] || [];

                            list[tag].push(node['Service']);
                        });
                    } else {
                        self.emit('warn', 'Service ID is required', node);
                    }
                });

                // sort services in groups by ID
                for (var group in list) {
                    if (list.hasOwnProperty(group)) {
                        list[group].sort(function (a, b) {
                            return a.ID.localeCompare(b.ID);
                        });
                    }
                }

                self.publish(list);
            });
        }

        setTimeout(function () {
            self.update();
        }, self.updateInterval);
    });
};

ServiceWatcher.prototype.publish = function (services) {
    this.emit('services', services);
};

module.exports = ServiceWatcher;
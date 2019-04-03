
(function($){

    'use strict';

    if(!this.Vue)
        return;

    if(this.Vcm)
        return;

    (function($this){

        $.vue = $this.Vue;

    })(this);

    (function(/* $.uri */){

        $.uri = Object.create(null);

        let dom = document.createElement('A');

        function getAbsoluteUri($uri, $trimEndSlash)
        {
            dom.href = $uri;

            $uri = dom.href;

            if($trimEndSlash !== true)
                return $uri;

            let match = /^(.*?)(\/+)?$/.exec($uri);

            return match[1];
        }

        $.uri.root = getAbsoluteUri('/', true);
        $.uri.base = getAbsoluteUri('.', true);

    })();

    (function(/* $.vcm */){

        let mapCache = {};

        $.vcm = Object.create(null);

        $.vcm.isValidObject = function($v){
            return ($v !== null && typeof($v) === 'object');
        };

        $.vcm.uri_resolve = function($uri, $base){
            let match = /^(\w+:)?(\/*)(.*)$/.exec($uri);
            if(typeof(match[1]) === 'string' && match[1].length > 0)
                return $uri;

            switch(match[2].length)
            {
                case 0:
                    return $base + '/' + match[3];
                case 1:
                    return $.uri.base + '/' + match[3];
            }

            return $.uri.root + '/' + match[3];
        };

        $.vcm.run = function(){
            return eval.call(null, arguments[0]);
        };

        $.vcm.createScope = function(){
            return 'ss-'+(new Date().getTime()).toString(36)+'-'+parseInt(('' + Math.random()).substr(2,6)).toString(36);
        };

        $.vcm.createStyle = function($component){
            let domStyle = document.createElement('STYLE');
            domStyle.type = 'text/css';
            domStyle.setAttribute('data-uri', $component['uriFull'].replace($.uri.base+'/', ''));

            if($component.scope.text === null)
            {
                domStyle.appendChild(document.createTextNode('\n'+$component.style+'\n'));
            }
            else
            {
                let content = $component.style.replace(/\/\*\[(.*?)\]\*\//g, function($all, $key){
                    switch($key)
                    {
                        case '#':
                            return '['+$component.scope.hash+']';
                        case '@':
                        case '':
                            return '['+$component.scope.name+']';
                    }

                    return $all;
                });

                domStyle.appendChild(document.createTextNode('\n'+content+'\n'));
            }

            document.querySelector('HEAD').appendChild(domStyle);
        };

        $.vcm.resolveCode = function($content, $uriBase, $uriFull){
            let match;

            let template = null;
            match = /<template([^>]*?)>[\r\n]*([\s\S]*?)[\r\n]*<\/template>/g.exec($content);
            if(match !== null)
                template = match[2];

            let style = null;
            match = /<style([^>]*?)>[\r\n]*([\s\S]*?)[\r\n]*<\/style>/g.exec($content);
            if(match !== null)
                style = match[2];

            match = /\s+scoped(="([^"]*?)")?/.exec(match[1]);
            let scope = null;
            if(match !== null)
                scope = match[2] || '';

            match = /<script([^>]*?)>[\r\n]*([\s\S]*?)[\r\n]*<\/script>/g.exec($content);
            if(match === null)
                return null;

            let arrCode = [
                '(function(){',
                'let component = Object.create(null);',
                'component.local = function($uri){return Vcm.local($uri, '+JSON.stringify($uriBase)+')};',
                'component.uriFull = '+JSON.stringify($uriFull)+';',
                'component.template = '+JSON.stringify(template)+';',
                'component.style = '+JSON.stringify(style)+';',
                'component.scope = '+JSON.stringify(scope)+';',
                '('+match[2]+').call(component);',
                'return component;',
                '})()'
            ];

            return arrCode.join('\n');
        };

        $.vcm.promise = function($uri, $uriBase, $config){
            return function($resolve, $reject){
                let uriFull = $.vcm.uri_resolve($uri, $uriBase);
                if($.vcm.isValidObject(mapCache[uriFull]) === true)
                    return $resolve(mapCache[uriFull].options);

                if($.vcm.isValidObject($config) === false)
                    $config = {};

                let axiosConfig = null;
                if($.vcm.isValidObject($config['axios']) === true)
                    axiosConfig = $config['axios'];

                axios.get(uriFull, axiosConfig).then(function($axios){
                    let match = /^(.*)\/(.*?)$/.exec(uriFull);

                    let code = $.vcm.resolveCode($axios.data, match[1], uriFull);
                    if(code === null)
                        return $reject('invalid component');

                    let component = $.vcm.run(code);

                    component.scope = {
                        text : component['scope'],
                        hash : null,
                        name : null,
                    };
                    if(typeof(component.scope.text) === 'string')
                    {
                        component.scope.hash = $.vcm.createScope();
                        component.scope.name = (component.scope.text==='')?component.scope.hash:component.scope.text;
                    }
                    else
                    {
                        component.scope.text = null;
                    }

                    $.vcm.createStyle(component);

                    if(component.scope.text !== null)
                    {
                        let methodMounted = null;
                        if(typeof(component.options.mounted) === 'function')
                            methodMounted = component.options.mounted;

                        component.options.mounted = (function($scope, $method){
                            return function(){
                                this.$el.setAttribute($scope.name, '');
                                this.$el.setAttribute($scope.hash, '');
                                if($method !== null)
                                    $method.apply(this, arguments);
                            };
                        })(component.scope, methodMounted);
                    }

                    mapCache[uriFull] = component;
                    $config.component = component;

                    $resolve(component.options);
                }).catch(function($error){
                    $reject($error);
                });
            };
        };

    })();

    (function($this){

        let mapSingleton = {
            $total : 0,
            $loaded : 0
        };

        function ensure_singleton($resolve, $reject)
        {
            if(mapSingleton.$loaded >= mapSingleton.$total)
                return $resolve(true);

            setTimeout(function(){
                ensure_singleton($resolve, $reject);
            }, 50);
        }

        $this.Vcm = Object.create(null);

        $this.Vcm.singleton = function($uri, $dom, $config){

            let uriFull = $.vcm.uri_resolve($uri, $.uri.base);
            if($.vcm.isValidObject(mapSingleton[uriFull]) === true)
                return;

            mapSingleton[uriFull] = false;
            mapSingleton.$total ++;

            if($.vcm.isValidObject($config) === false)
                $config = {};

            new Promise($.vcm.promise($uri, $.uri.base, $config)).then(function($options){

                let ctor     = $.vue.extend($options);
                let instance = new ctor().$mount();

                if($dom instanceof Node === false)
                    $dom = document.body;

                $dom.appendChild(instance.$el);

                if($config.component.export instanceof Function)
                {
                    $config.component.export.call(instance, $.vue);
                }

                mapSingleton.$loaded ++;
                mapSingleton[uriFull] = true;
            });
        };

        $this.Vcm.global = function($tag, $uri, $config){
            $.vue.component($tag, function($resolve, $reject){
                Promise.all([
                    new Promise(ensure_singleton),
                    new Promise($.vcm.promise($uri, $.uri.base, $config))
                ]).then(function($data){
                    $resolve($data[1]);
                }).catch(function($error){
                    $reject($error);
                });
            });
        };

        $this.Vcm.local = function($uri, $uriBase, $config){
            return function($resolve, $reject){
                Promise.all([
                    new Promise(ensure_singleton),
                    new Promise($.vcm.promise($uri, $uriBase || $.uri.base, $config))
                ]).then(function($data){
                    $resolve($data[1]);
                }).catch(function($error){
                    $reject($error);
                });
            };
        };

    })(this);

}).call(eval.call(null, 'this'), Object.create(null));
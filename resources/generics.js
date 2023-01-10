'use strict';

class NodeGenerics {
    constructor (node) {
        this.node = node;
        this.functions = [];
        this.installations = [];
        this.selectedServer = RED.nodes.node(node.server.id ?? node.server);
        this.selectedInstallation = node.installation_id;
        this.selectedFunction = node.function_id;
        let _this = this;

        $('select#node-input-server').on('change', function (e) {
            if (!e.isTrigger) {
                _this.selectedServer = RED.nodes.node(e.target.value ?? _this.node.server.id);
                if (_this.selectedServer) {
                    _this.serverSelected();
                }
            }
        });

        $('select#node-input-installation_id').on('change', function (e) {
            let val = e.target.value;
            if (!e.isTrigger && _this.installations !== undefined) {
                _this.installations.forEach(inst => {
                    let id = val ? parseInt(val) : _this.node.installation_id;
                    if (inst.id === id) {
                        _this.selectedInstallation = inst;
                    }
                });
                if (_this.selectedServer) {
                    _this.installationSelected();
                }
            }
        });

        $('select#node-input-function_id').on('change', function (e) {
            let val = e.target.value;
            if (!e.isTrigger && _this.functions !== undefined) {
                _this.functions.forEach(fun => {
                    let id = val ? parseInt(val) : _this.node.function_id;
                    if (fun.id === id) {
                        _this.selectedFunction = fun;
                    }
                });
                if (_this.selectedServer) {
                    _this.functionSelected();
                }
            }
        });
    };

    functionSelected = () => {
        let _this = this;
        let inputType = $('#node-input-type');

        if (_this.node.function_id !== _this.selectedFunction.id) {
            console.log('function was different');
            _this.node.function_id = _this.selectedFunction.id;
            _this.node.function_name = _this.selectedFunction.meta.name;
        }

        inputType.empty();

        let shouldSelectFirst = true;
        let btns = Object.keys(_this.selectedFunction.meta)
            .filter(key => key.startsWith('topic_'))
            .map(key => {
                let val = _this.selectedFunction.meta[key];
                let metaType = key.substring(key.indexOf('_') + 1);
                let topicButton = _this.getTopicButton(metaType, val);
                if (val === _this.node.topic) {
                    shouldSelectFirst = false;
                    console.log('function clicked topic');
                    topicButton.click();
                }
                return topicButton;
            });
        inputType.append(btns);

        if (shouldSelectFirst) {
            console.log('function selected first topic');
            let btns = inputType.children();
            if (btns.length > 0) btns[0].click();
        }
    };

    getTopicButton = (metaType, metaValue) => {
        let _this = this;
        let btn = $('<button type="button" id="type-' + metaType + '" value="' + metaValue + '" class="red-ui-button toggle type-button-group">' + metaType + '<button/>');

        if (_this.node.topic === metaValue) {
            btn.addClass('selected');
        }
        btn.on('click', (e) => {
            $('.type-button-group').removeClass('selected');
            btn.addClass('selected');
            _this.node.topic = metaValue;
        });
        return btn[0];
    };

    installationSelected () {
        let _this = this;
        let select = $('select#node-input-function_id');

        if (_this.node.installation_id !== _this.selectedInstallation.id) {
            console.log('installation was different');
            _this.node.installation_id = _this.selectedInstallation.id;
            _this.node.client_id = _this.selectedInstallation.client_id;
        }

        $.getJSON('lynx/functions/' + _this.selectedInstallation.id, {
            url: _this.selectedServer.url,
            apiKey: _this.selectedServer.api_key,
        }, function (data) {
            select.empty();
            if (Array.isArray(data)) {
                let shouldSelectFirst = true;
                _this.functions = data.sort((a, b) => {
                    let aVal = a?.meta?.name ?? '';
                    let bVal = b?.meta?.name ?? '';
                    return aVal.toLowerCase().localeCompare(bVal.toLowerCase());
                });
                let opts = _this.functions.map(fun => {
                    let selected = _this.node.function_id === fun.id;
                    if (selected) {
                        shouldSelectFirst = false;
                        _this.selectedFunction = fun;
                    }
                    return new Option(fun.meta.name, fun.id, selected, selected);
                });
                if (shouldSelectFirst && _this.functions.length > 0) {
                    console.log('selected first function');
                    _this.selectedFunction = _this.functions[0];
                }
                select.append(opts);
                console.log('installation selected function');
                _this.functionSelected();
            }
        });
    };

    serverSelected () {
        let _this = this;
        let select = $('select#node-input-installation_id');
        this.node.server = this.selectedServer.id;

        $.getJSON('lynx/installations', {
            url: _this.selectedServer.url,
            apiKey: _this.selectedServer.api_key,
        }, function (data) {
            select.empty();
            if (Array.isArray(data)) {
                let shouldSelectFirst = true;
                _this.installations = data;
                let opts = _this.installations.map(installation => {
                    let selected = _this.node.installation_id === installation.id;
                    if (selected) {
                        shouldSelectFirst = false;
                        _this.selectedInstallation = installation;
                    }
                    return new Option(installation.name, installation.id, selected, selected);
                });

                if (shouldSelectFirst && _this.installations.length > 0) {
                    console.log('first-installation');
                    _this.selectedInstallation = _this.installations[0];
                }
                select.append(opts);
                console.log('server selected installation');
                _this.installationSelected();
            }
        });
    };
}

'use strict';

class NodeGenerics {
    constructor (node) {
        this.node = { ...node };
        this.functions = [];
        this.installations = [];
        this.selectedServer = RED.nodes.node(node.server.id ?? node.server);
        this.selectedInstallation = undefined;
        this.selectedFunction = undefined;
        this.selectedTopic = undefined;

        $('select#node-input-server').on('change', function (e) {
            if (!e.isTrigger) {
                this.selectedServer = RED.nodes.node(e.target.value ?? this.node.server.id);
                if (this.selectedServer) {
                    this.serverSelected();
                }
            }
        }.bind(this));

        $('select#node-input-installation_id').on('change', function (e) {
            let val = e.target.value;
            if (!e.isTrigger && this.installations !== undefined) {
                this.installations.forEach(inst => {
                    let id = val ? parseInt(val) : this.node.installation_id;
                    if (inst.id === id) {
                        this.selectedInstallation = inst;
                    }
                });
                if (this.selectedServer) {
                    this.installationSelected();
                }
            }
        }.bind(this));

        $('select#node-input-function_id').on('change', function (e) {
            let val = e.target.value;
            if (!e.isTrigger && this.functions !== undefined) {
                this.functions.forEach(fun => {
                    let id = val ? parseInt(val) : this.node.function_id;
                    if (fun.id === id) {
                        this.selectedFunction = fun;
                    }
                });
                if (this.selectedServer) {
                    this.functionSelected();
                }
            }
        }.bind(this));
    };

    functionSelected = () => {
        let inputType = $('#node-input-type');
        inputType.empty();
        let alreadySelected = false;
        let shouldSelectFirst = true;
        let btns = Object.keys(this.selectedFunction.meta)
            .filter(key => key.startsWith('topic_'))
            .map(key => {
                let val = this.selectedFunction.meta[key];
                let metaType = key.substring(key.indexOf('_') + 1);
                let topicButton = this.getTopicButton(metaType, val);
                if (val === this.node.topic && !alreadySelected) {
                    alreadySelected = true;
                    shouldSelectFirst = false;
                    topicButton.click();
                }
                return topicButton;
            });
        inputType.append(btns);

        if (shouldSelectFirst) {
            let btns = inputType.children();
            if (btns.length > 0) btns[0].click();
        }
    };

    getTopicButton = (metaType, metaValue) => {
        let btn = $('<button type="button" id="type-' + metaType + '" value="' + metaValue + '" class="red-ui-button toggle type-button-group">' + metaType + '<button/>');
        btn.on('click', (e) => {
            $('.type-button-group').removeClass('selected');
            btn.addClass('selected');
            this.selectedTopic = metaValue;
        });
        return btn[0];
    };

    installationSelected () {
        let select = $('select#node-input-function_id');

        $.getJSON('lynx/functions/' + this.selectedInstallation.id, {
            url: this.selectedServer.url,
            apiKey: this.selectedServer.api_key,
        }, function (data) {
            select.empty();
            if (Array.isArray(data)) {
                let shouldSelectFirst = true;
                this.functions = data.sort((a, b) => {
                    let aVal = a?.meta?.name ?? '';
                    let bVal = b?.meta?.name ?? '';
                    return aVal.toLowerCase().localeCompare(bVal.toLowerCase());
                });
                let opts = this.functions.map(fun => {
                    let selected = this.node.function_id === fun.id;
                    if (selected) {
                        shouldSelectFirst = false;
                        this.selectedFunction = fun;
                    }
                    return new Option(fun.meta.name, fun.id, selected, selected);
                });
                if (this.functions.length > 0) {
                    if (shouldSelectFirst) {
                        this.selectedFunction = this.functions[0];
                    }
                    select.append(opts);
                    this.functionSelected();
                }
            }
        }.bind(this));
    };

    serverSelected () {
        let select = $('select#node-input-installation_id');

        $.getJSON('lynx/installations', {
            url: this.selectedServer.url,
            apiKey: this.selectedServer.api_key,
        }, function (data) {
            select.empty();
            if (Array.isArray(data)) {
                let shouldSelectFirst = true;
                this.installations = data;
                let opts = this.installations.map(installation => {
                    let selected = this.node.installation_id === installation.id;
                    if (selected) {
                        shouldSelectFirst = false;
                        this.selectedInstallation = installation;
                    }
                    return new Option(installation.name, installation.id, selected, selected);
                });
                if (this.installations.length > 0) {
                    if (shouldSelectFirst) {
                        this.selectedInstallation = this.installations[0];
                    }
                    select.append(opts);
                    this.installationSelected();
                }
            }
        }.bind(this));
    };
}

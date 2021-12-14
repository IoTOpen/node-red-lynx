'user strict'

class NodeGenerics {
    constructor(node) {
        this.node = node;
        this.functions = [];
        this.installations = [];
        this.selectedServer = RED.nodes.node(node.server.id ? node.server.id : node.server);
        this.selectedInstallation = node.installation_id;
        this.selectedFunction = node.function_id;
        let $this = this;
    
        $("select#node-input-server").change(function (e) {
            if (!e.isTrigger) {
                let val = $(this).val();
                $this.selectedServer = RED.nodes.node(val ? val : $this.node.server.id);
                if ($this.selectedServer) {
                    $this.serverSelected();
                }
            }
        });

        $("select#node-input-installation_id").change(function (e) {
            if (!e.isTrigger) {
                let val = $(this).val();
                $this.selectedInstallation = val ? parseInt(val) : $this.node.installation_id;
                if ($this.selectedServer) {
                    $this.installationSelected($this.selectedInstallation);
                }
            }
        });

        $("select#node-input-function_id").change(function (e) {
            if (!e.isTrigger) {
                let val = $(this).val();
                $this.selectedFunction = val ? parseInt(val) : $this.node.function_id;
                if ($this.selectedServer) {
                    $this.functionSelected();
                }
            }
        });
    }

    functionSelected = () => {
        this.functions.map(fun => {
            if (fun.id === this.selectedFunction) {
                RED.nodes.dirty(this.node.function_id !== this.selectedFunction);
                this.node.function_id = fun.id;
                this.node.function_name = fun.meta.name;
                let inputType = $("#node-input-type");
                inputType.empty();

                let selectFirst = true;
                for (let key in fun.meta) {
                    if (fun.meta.hasOwnProperty(key) && key.startsWith("topic_")) {
                        let topicButton = this.getTopicButton(key, fun.meta[key]);
                        inputType.append(topicButton);
                        if (fun.meta[key] === this.node.topic) {
                            selectFirst = false;
                            topicButton.click();
                        }
                    }
                }
                if (selectFirst) {
                    let btns = $("#node-input-type").children(":button");
                    if (btns.length > 0) btns[0].click();
                }
            }
        });
    }

    getTopicButton = (metaKey, metaValue) => {
        let lynx = this;
        let metaType = metaKey.substring(metaKey.indexOf('_') + 1, metaKey.length);
        let btn = $('<button type="button" id="type-' + metaType + '" value="' + metaValue + '" class="red-ui-button toggle type-button-group">' + metaType + '<button/>');
        if (lynx.node.topic === metaValue) {
            btn.addClass("selected");
        }
        btn.click(function () {
            $(".type-button-group").removeClass("selected");
            $(this).addClass("selected");
            let val = $(this).val()
            RED.nodes.dirty(lynx.node.topic !== val)
            lynx.node.topic = val;
        });
        return btn[0];
    }

    installationSelected(installationId) {
        this.installations.map(installation => {
            if (this.selectedInstallation === installation.id) {
                this.node.installation_id = installation.id;
                this.node.client_id = installation.client_id;
            }
        });
        let selectFirst = true;
        let lynx = this;
        $.getJSON('lynx/functions/' + this.selectedInstallation, {
            url: this.selectedServer.url,
            apiKey: this.selectedServer.api_key,
        }, function (data) {
            if (lynx.selectedInstallation === installationId) {
                let select = $("select#node-input-function_id");
                select.empty();
                if (Array.isArray(data)) {
                    lynx.functions = data.sort((a,b) => {
                        return a.meta.name.toLowerCase().localeCompare(b.meta.name.toLowerCase());
                    });                            
                    lynx.functions.map(fun => {
                        let selected = lynx.selectedFunction === fun.id;
                        select.append(new Option(fun.meta.name, fun.id, selected, selected));
                        if (selected) {
                            selectFirst = false;
                            lynx.selectedFunction = fun.id;
                            lynx.functionSelected();
                        }
                    });
                    if (selectFirst && lynx.functions.length > 0) {
                        lynx.selectedFunction = lynx.functions[0].id;
                        lynx.functionSelected();
                    }
                }
            }
        });
    }
    
    serverSelected() {
        let selectFirst = true;
        this.node.server = this.selectedServer.id;
        let lynx = this;

        $.getJSON('lynx/installations', {
            url: this.selectedServer.url,
            apiKey: this.selectedServer.api_key,
        }, function (data) {
            let select = $("select#node-input-installation_id");
            select.empty();
            if (Array.isArray(data)) {
                lynx.installations = data;
                lynx.installations.map(installation => {
                    let selected = lynx.selectedInstallation === installation.id;
                    select.append(new Option(installation.name, installation.id, selected, selected));
                    if (selected) {
                        selectFirst = false;
                        lynx.selectedInstallation = installation.id;
                        lynx.installationSelected(lynx.selectedInstallation);
                    }
                });
                if (selectFirst && lynx.installations.length > 0) {
                    lynx.selectedInstallation = lynx.installations[0].id;
                    lynx.installationSelected(lynx.selectedInstallation);
                }
            }
        });
    }
    
}

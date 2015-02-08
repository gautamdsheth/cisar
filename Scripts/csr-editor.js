﻿var CSREditor;
(function (CSREditor) {
    var ChromeIntegration = (function () {
        function ChromeIntegration() {
        }
        ChromeIntegration.setResourceAddedListener = function (siteUrl, callback) {
            chrome.devtools.inspectedWindow.onResourceAdded.addListener(function (resource) {
                var resUrl = CSREditor.Utils.cutOffQueryString(resource.url.toLowerCase().replace(' ', '%20'));

                if (CSREditor.Utils.endsWith(resUrl, ".js") && resUrl.indexOf(siteUrl) == 0 && resUrl.indexOf('/_layouts/') == -1)
                    callback(CSREditor.Utils.cutOffQueryString(resource.url));
            });
        };

        ChromeIntegration.getAllResources = function (siteUrl, callback) {
            if (window["chrome"] && chrome.devtools) {
                chrome.devtools.inspectedWindow.getResources(function (resources) {
                    var urls = {};
                    for (var i = 0; i < resources.length; i++) {
                        var resUrl = CSREditor.Utils.cutOffQueryString(resources[i].url.toLowerCase().replace(' ', '%20'));

                        if (CSREditor.Utils.endsWith(resUrl, ".js") && resUrl.indexOf(siteUrl) == 0 && resUrl.indexOf('/_layouts/') == -1)
                            urls[CSREditor.Utils.cutOffQueryString(resources[i].url)] = 1;
                    }
                    callback(urls);
                });
            } else
                callback({});
        };

        ChromeIntegration.getResourceContent = function (url, callback) {
            chrome.devtools.inspectedWindow.getResources(function (resources) {
                url = CSREditor.Utils.cutOffQueryString(url.toLowerCase().replace(' ', '%20'));
                for (var i = 0; i < resources.length; i++) {
                    var resUrl = CSREditor.Utils.cutOffQueryString(resources[i].url.toLowerCase().replace(' ', '%20'));
                    if (resUrl == url || (url[0] == "/" && CSREditor.Utils.endsWith(resUrl, url))) {
                        resources[i].getContent(function (content, encoding) {
                            callback(content || "");
                        });
                        return;
                    }
                }
                callback("");
            });
        };

        ChromeIntegration.setResourceContent = function (url, content, callback) {
            chrome.devtools.inspectedWindow.getResources(function (resources) {
                url = CSREditor.Utils.cutOffQueryString(url.toLowerCase().replace(' ', '%20'));
                for (var i = 0; i < resources.length; i++) {
                    var resUrl = CSREditor.Utils.cutOffQueryString(resources[i].url.toLowerCase().replace(' ', '%20'));
                    if (resUrl == url || (url[0] == "/" && CSREditor.Utils.endsWith(resUrl, url))) {
                        resources[i].setContent(content, true, callback);
                        return;
                    }
                }
            });
        };

        ChromeIntegration.eval = function (code, callback) {
            if (window["chrome"] && chrome.devtools) {
                chrome.devtools.inspectedWindow.eval(code, callback || function (result, errorInfo) {
                    if (errorInfo)
                        console.log(errorInfo);
                });
            }
        };

        ChromeIntegration.executeInContentScriptContext = function (code) {
            if (!window["chrome"] || !chrome.tabs)
                return false;

            chrome.tabs.executeScript({
                code: code
            });

            return true;
        };
        return ChromeIntegration;
    })();
    CSREditor.ChromeIntegration = ChromeIntegration;
})(CSREditor || (CSREditor = {}));
var B64;

var CSREditor;
(function (CSREditor) {
    var FilesList = (function () {
        function FilesList() {
        }
        FilesList.addFiles = function (urls, loadUrlToEditor) {
            FilesList.loadUrlToEditor = loadUrlToEditor;

            for (var url in urls) {
                if (!FilesList.files[url]) {
                    FilesList.appendFileToList(url);
                    FilesList.files[url] = 1;
                }
            }

            document.querySelector('.files > div.add').onclick = function (ev) {
                FilesList.displayAddNewFileUI();
            };

            document.querySelector('.separator').onclick = function (ev) {
                if (document.body.className.indexOf("fullscreen") > -1)
                    document.body.className = document.body.className.replace("fullscreen", "");
                else
                    document.body.className += " fullscreen";
            };
        };

        FilesList.appendFileToList = function (url, justcreated) {
            if (typeof justcreated === "undefined") { justcreated = false; }
            var filesDiv = document.querySelector('.files');
            var div = document.createElement("div");
            div.title = url;
            div.onclick = function (ev) {
                FilesList.makeFileCurrent(url, div);
            };

            var removeButton = document.createElement('a');
            removeButton.onclick = function (ev) {
                if (confirm('Sure to move the file to recycle bin and unbind it from the webpart?')) {
                    FilesList.removeFile(url);
                    div.parentNode.removeChild(div);
                }
                ev.preventDefault();
                ev.stopPropagation();
            };
            removeButton.className = "remove-button";
            removeButton.innerHTML = "╳";
            removeButton.title = "delete file";
            div.appendChild(removeButton);

            div.appendChild(document.createTextNode(url.substr(url.lastIndexOf('/') + 1)));

            if (justcreated)
                div.className = "justcreated";

            if (justcreated && filesDiv.querySelector('.add').nextSibling)
                filesDiv.insertBefore(div, filesDiv.querySelector('.add').nextSibling);
            else
                filesDiv.appendChild(div);

            return div;
        };

        FilesList.makeFileCurrent = function (url, div, loadContent) {
            if (typeof loadContent === "undefined") { loadContent = true; }
            var divs = document.querySelectorAll(".files > div.current");
            for (var j = 0; j < divs.length; j++) {
                divs[j].className = null;
            }

            div.className = "current";

            if (loadContent)
                FilesList.loadUrlToEditor(url);
        };

        FilesList.displayAddNewFileUI = function () {
            if (document.querySelector('.files > div.add > input') == null) {
                var addDiv = document.querySelector('.files > div.add');
                var helpDiv = document.createElement('div');
                helpDiv.innerHTML = "Enter a filename.<br/>Path: '" + FilesList.filesPath + "'<br/>[Enter] to create the file, [ESC] to cancel.";
                var input = document.createElement('input');
                input.type = "text";
                input.onkeydown = function (event) {
                    if ((event.keyCode == 13 && input.value != "") || event.keyCode == 27) {
                        if (event.keyCode == 13) {
                            var newFileName = input.value;
                            if (!CSREditor.Utils.endsWith(newFileName, ".js"))
                                newFileName += ".js";

                            FilesList.performNewFileCreation(newFileName);
                        }

                        addDiv.removeChild(input);
                        addDiv.removeChild(helpDiv);
                        event.preventDefault();
                        event.stopPropagation();
                    } else {
                        var safe = false;
                        if (event.keyCode >= 65 && event.keyCode <= 90)
                            safe = true;
                        if (event.keyCode >= 48 && event.keyCode <= 57 && event.shiftKey == false)
                            safe = true;
                        if ([8, 35, 36, 37, 38, 39, 40, 46, 189].indexOf(event.keyCode) > -1)
                            safe = true;
                        if (event.keyCode == 190 && event.shiftKey == false)
                            safe = true;
                        if (event.char == "")
                            safe = true;

                        if (!safe) {
                            event.preventDefault();
                            event.stopPropagation();
                            return false;
                        }
                    }
                };
                addDiv.appendChild(input);
                addDiv.appendChild(helpDiv);
                input.focus();
            }
        };

        FilesList.performNewFileCreation = function (newFileName) {
            CSREditor.ChromeIntegration.eval("(" + CSREditor.SPActions.createFileInSharePoint + ")('" + FilesList.filesPath.replace(' ', '%20').toLowerCase() + "', '" + newFileName + "');", function (result, errorInfo) {
                if (!errorInfo) {
                    var handle = setInterval(function () {
                        CSREditor.ChromeIntegration.eval("(" + CSREditor.SPActions.checkFileCreated + ")();", function (result2, errorInfo) {
                            if (errorInfo)
                                console.log(errorInfo);
                            else if (result2 != "wait") {
                                clearInterval(handle);
                                if (result2 == "created")
                                    FilesList.fileWasCreated(newFileName, result);
                                else if (result2 == "error")
                                    alert("There was an error when creating the file. Please check console for details.");
                            }
                        });
                    }, 1000);
                }
            });
        };

        FilesList.fileWasCreated = function (newFileName, result) {
            var fullUrl = (FilesList.siteUrl + FilesList.filesPath.replace(' ', '%20') + newFileName).toLowerCase();
            var div = FilesList.appendFileToList(fullUrl, true);
            FilesList.makeFileCurrent(fullUrl, div, false);

            var wptype = result.isListForm ? "LFWP" : "XLV";
            CSREditor.Panel.setEditorText(fullUrl, '// The file has been created, saved into "' + FilesList.filesPath + '"\r\n' + '// and attached to the ' + wptype + ' via JSLink property.\r\n\r\n' + 'SP.SOD.executeFunc("clienttemplates.js", "SPClientTemplates", function() {\r\n\r\n' + '  function getBaseHtml(ctx) {\r\n' + '    return SPClientTemplates["_defaultTemplates"].Fields.default.all.all[ctx.CurrentFieldSchema.FieldType][ctx.BaseViewID](ctx);\r\n' + '  }\r\n\r\n' + '  function init() {\r\n\r\n' + '    SPClientTemplates.TemplateManager.RegisterTemplateOverrides({\r\n\r\n' + '      // OnPreRender: function(ctx) { },\r\n\r\n' + '      Templates: {\r\n\r\n' + (result.isListForm ? '' : '      //     View: function(ctx) { return ""; },\r\n' + '      //     Header: function(ctx) { return ""; },\r\n' + '      //     Body: function(ctx) { return ""; },\r\n' + '      //     Group: function(ctx) { return ""; },\r\n' + '      //     Item: function(ctx) { return ""; },\r\n') + '      //     Fields: {\r\n' + '      //         "<fieldInternalName>": {\r\n' + '      //             View: function(ctx) { return ""; },\r\n' + '      //             EditForm: function(ctx) { return ""; },\r\n' + '      //             DisplayForm: function(ctx) { return ""; },\r\n' + '      //             NewForm: function(ctx) { return ""; },\r\n' + '      //         }\r\n' + '      //     },\r\n' + (result.isListForm ? '' : '      //     Footer: function(ctx) { return ""; }\r\n') + '\r\n' + '      },\r\n\r\n' + '      // OnPostRender: function(ctx) { },\r\n\r\n' + (result.isListForm ? '' : '      BaseViewID: ' + result.baseViewId + ',\r\n') + '      ListTemplateType: ' + result.listTemplate + '\r\n\r\n' + '    });\r\n' + '  }\r\n\r\n' + '  RegisterModuleInit(SPClientTemplates.Utility.ReplaceUrlTokens("~siteCollection' + FilesList.filesPath + newFileName + '"), init);\r\n' + '  init();\r\n\r\n' + '});\r\n');
        };

        FilesList.refreshCSR = function (url, content) {
            url = CSREditor.Utils.cutOffQueryString(url.replace(FilesList.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;

            CSREditor.ChromeIntegration.eval("(" + CSREditor.SPActions.performCSRRefresh + ")('" + url + "', '" + content.replace(/\/\*.+?\*\/|\/\/.*(?=[\n\r])/g, '').replace(/\r?\n\s*|\r\s*/g, ' ').replace(/'/g, "\\'") + "');");
        };

        FilesList.saveChangesToFile = function (url, content) {
            url = CSREditor.Utils.cutOffQueryString(url.replace(FilesList.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;

            FilesList.savingQueue[url] = { content: content, cooldown: 5 };

            if (!FilesList.savingProcess) {
                FilesList.savingProcess = setInterval(function () {
                    for (var fileUrl in FilesList.savingQueue) {
                        FilesList.savingQueue[fileUrl].cooldown--;
                        if (FilesList.savingQueue[fileUrl].cooldown <= 0) {
                            CSREditor.ChromeIntegration.eval("(" + CSREditor.SPActions.saveFileToSharePoint + ")('" + fileUrl + "', '" + B64.encode(FilesList.savingQueue[fileUrl].content) + "');");
                            delete FilesList.savingQueue[fileUrl];
                        }
                    }
                }, 2000);
            }
        };

        FilesList.removeFile = function (url) {
            url = CSREditor.Utils.cutOffQueryString(url.replace(FilesList.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;
            CSREditor.Panel.setEditorText(null, '');
            CSREditor.ChromeIntegration.eval("(" + CSREditor.SPActions.removeFileFromSharePoint + ")('" + url + "');");
        };
        FilesList.filesPath = "/Style Library/";
        FilesList.siteUrl = "";

        FilesList.savingQueue = {};
        FilesList.savingProcess = null;
        FilesList.files = {};
        return FilesList;
    })();
    CSREditor.FilesList = FilesList;
})(CSREditor || (CSREditor = {}));
var CSREditor;
(function (CSREditor) {
    var Utils = (function () {
        function Utils() {
        }
        Utils.endsWith = function (s, suffix) {
            return s.indexOf(suffix, s.length - suffix.length) !== -1;
        };
        Utils.cutOffQueryString = function (s) {
            if (s.indexOf('?') > 0)
                s = s.substr(0, s.indexOf('?'));
            return s;
        };
        return Utils;
    })();
    CSREditor.Utils = Utils;

    var Panel = (function () {
        function Panel() {
            this.loadingData = false;
            this.tooltipLastPos = { line: -1, ch: -1 };
            this.changed = false;
            this.doNotSave = false;
        }
        Panel.start = function () {
            Panel.instance = new Panel();
            Panel.instance.initialize();
        };

        Panel.prototype.initialize = function () {
            Panel.instance.typeScriptService = new CSREditor.TypeScriptService();
            Panel.instance.editorCM = Panel.instance.initEditor();

            Panel.instance.changed = false;
            Panel.instance.loadingData = false;

            localStorage["fileName"] = null;

            var loadUrlToEditor = function (url) {
                CSREditor.ChromeIntegration.getResourceContent(url, function (text) {
                    Panel.setEditorText(url, text);
                });
            };

            CSREditor.ChromeIntegration.eval("_spPageContextInfo.siteAbsoluteUrl", function (result, errorInfo) {
                if (!errorInfo) {
                    var siteUrl = result.toLowerCase();
                    CSREditor.FilesList.siteUrl = siteUrl;
                    CSREditor.ChromeIntegration.getAllResources(siteUrl, function (urls) {
                        CSREditor.FilesList.addFiles(urls, loadUrlToEditor);
                    });
                    CSREditor.ChromeIntegration.setResourceAddedListener(siteUrl, function (url) {
                        var urls = {};
                        urls[url] = 1;
                        CSREditor.FilesList.addFiles(urls, loadUrlToEditor);
                    });
                }
            });
        };

        Panel.isChanged = function () {
            return Panel.instance.changed;
        };

        Panel.prototype.initEditor = function () {
            var editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
                lineNumbers: true,
                matchBrackets: true,
                mode: "text/typescript",
                readOnly: true
            });

            editor.on("cursorActivity", function (cm) {
                if (cm.getDoc().getCursor().line != Panel.instance.tooltipLastPos.line || cm.getDoc().getCursor().ch < Panel.instance.tooltipLastPos.ch) {
                    $('.tooltip').remove();
                }
            });

            editor.on("change", function (editor, changeList) {
                Panel.instance.processChanges(editor.getDoc(), changeList);
            });
            return editor;
        };

        Panel.setEditorText = function (url, text) {
            localStorage["fileName"] = url;
            Panel.instance.editorCM.getDoc().setValue(text);
            Panel.instance.editorCM.setOption("readOnly", url == null);
        };

        Panel.prototype.showCodeMirrorHint = function (cm, list) {
            list.sort(function (l, r) {
                if (l.displayText > r.displayText)
                    return 1;
                if (l.displayText < r.displayText)
                    return -1;
                return 0;
            });

            cm.getEditor()["showHint"]({
                completeSingle: false,
                hint: function (cm) {
                    var cur = cm.getCursor();
                    var token = cm.getTokenAt(cur);
                    var completionInfo = null;
                    var show_words = [];
                    if (token.string == ".") {
                        for (var i = 0; i < list.length; i++) {
                            if (list[i].livePreview == false)
                                show_words.push(list[i]);
                        }

                        completionInfo = { from: cur, to: cur, list: show_words };
                    } else if (token.string == "," || token.string == "(") {
                        completionInfo = { from: cur, to: cur, list: list };
                    } else {
                        for (var i = 0; i < list.length; i++) {
                            if (list[i].text.toLowerCase().indexOf(token.string.toLowerCase()) > -1)
                                show_words.push(list[i]);
                        }

                        completionInfo = {
                            from: { line: cur.line, ch: token.start },
                            to: { line: cur.line, ch: token.end },
                            list: show_words
                        };
                    }

                    var tooltip;
                    CodeMirror.on(completionInfo, "select", function (completion, element) {
                        $('.tooltip').remove();
                        if (completion.typeInfo) {
                            $(element).tooltip({
                                html: true,
                                title: '<div class="tooltip-typeInfo">' + completion.typeInfo + '</div>' + '<div class="tooltip-docComment">' + completion.docComment.replace('\n', '<br/>') + '</div>',
                                trigger: 'manual', container: 'body', placement: 'right'
                            });
                            $(element).tooltip('show');
                        }
                    });
                    CodeMirror.on(completionInfo, "close", function () {
                        $('.tooltip').remove();
                    });

                    return completionInfo;
                }
            });
        };

        Panel.prototype.showAutoCompleteDropDown = function (cm, changePosition) {
            var scriptPosition = cm.indexFromPos(changePosition) + 1;
            var completions = Panel.instance.typeScriptService.getCompletions(scriptPosition);

            if (completions == null)
                return;

            $('.tooltip').remove();

            var list = [];
            for (var i = 0; i < completions.entries.length; i++) {
                var details = Panel.instance.typeScriptService.getCompletionDetails(scriptPosition, completions.entries[i].name);
                list.push({
                    text: completions.entries[i].name,
                    displayText: completions.entries[i].name,
                    typeInfo: details.type,
                    kind: completions.entries[i].kind,
                    docComment: details.docComment,
                    className: "autocomplete-" + completions.entries[i].kind,
                    livePreview: false
                });
            }

            Panel.instance.showCodeMirrorHint(cm, list);
        };

        Panel.prototype.showFunctionTooltip = function (cm, changePosition) {
            $('.tooltip').remove();

            var signature = Panel.instance.typeScriptService.getSignature(cm.indexFromPos(changePosition) + 1);

            if (signature) {
                Panel.instance.tooltipLastPos = changePosition;
                var cursorCoords = cm.getEditor().cursorCoords(cm.getCursor(), "page");
                var domElement = cm.getEditor().getWrapperElement();

                $(domElement).data('bs.tooltip', false).tooltip({
                    html: true,
                    title: '<div class="tooltip-typeInfo">' + signature.formal[0].signatureInfo + '</div>' + '<div class="tooltip-docComment">' + signature.formal[0].docComment.replace('\n', '<br/>') + '</div>',
                    trigger: 'manual', container: 'body', placement: 'bottom'
                });
                $(domElement).off('shown.bs.tooltip').on('shown.bs.tooltip', function () {
                    $('.tooltip').css('top', cursorCoords.bottom + "px").css('left', cursorCoords.left + "px");
                });
                $(domElement).tooltip('show');
            }
        };

        Panel.prototype.processChanges = function (cm, changeObj) {
            if (!changeObj)
                return;

            Panel.instance.changed = true;
            Panel.instance.typeScriptService.scriptChanged(cm.getValue(), cm.indexFromPos(changeObj.from), cm.indexFromPos(changeObj.to) - cm.indexFromPos(changeObj.from));
            if (Panel.instance.doNotSave == false) {
                var url = localStorage["fileName"];
                if (url != "null") {
                    CSREditor.FilesList.refreshCSR(url, cm.getValue());
                    CSREditor.FilesList.saveChangesToFile(url, cm.getValue());
                    Panel.instance.changed = false;
                }
            }

            if (changeObj.text.length == 1 && (changeObj.text[0] == '.' || changeObj.text[0] == ' ')) {
                Panel.instance.showAutoCompleteDropDown(cm, changeObj.to);
                return;
            } else if (changeObj.text.length == 1 && (changeObj.text[0] == '(' || changeObj.text[0] == ',')) {
                Panel.instance.showFunctionTooltip(cm, changeObj.to);
            } else if (changeObj.text.length == 1 && changeObj.text[0] == ')') {
                $('.tooltip').remove();
            }

            Panel.instance.checkSyntax(cm);
        };

        Panel.prototype.checkSyntax = function (cm) {
            var allMarkers = cm.getAllMarks();
            for (var i = 0; i < allMarkers.length; i++) {
                allMarkers[i].clear();
            }

            if (Panel.checkSyntaxTimeout)
                clearTimeout(Panel.checkSyntaxTimeout);

            Panel.checkSyntaxTimeout = setTimeout(function () {
                var errors = Panel.instance.typeScriptService.getErrors();
                for (var i = 0; i < errors.length; i++) {
                    cm.markText(cm.posFromIndex(errors[i].start()), cm.posFromIndex(errors[i].start() + errors[i].length()), {
                        className: "syntax-error",
                        title: errors[i].text()
                    });
                }
            }, 1500);
        };
        Panel.checkSyntaxTimeout = 0;
        return Panel;
    })();
    CSREditor.Panel = Panel;
})(CSREditor || (CSREditor = {}));
var B64;

var CSREditor;
(function (CSREditor) {
    var SPActions = (function () {
        function SPActions() {
        }
        SPActions.createFileInSharePoint = function (path, fileName) {
            var wpqId = 2;
            var formContext = null;
            while ($get("WebPartWPQ" + wpqId) != null) {
                if (window["WPQ" + wpqId + "FormCtx"]) {
                    formContext = window["WPQ" + wpqId + "FormCtx"];
                    break;
                }
                wpqId++;
            }

            path = path.replace('%20', ' ');

            if (formContext || window["ctx"]) {
                SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                    var context = SP.ClientContext.get_current();

                    var files = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files();
                    context.load(files, "Include(Name)");

                    var wpid;
                    if (formContext)
                        wpid = $get("WebPartWPQ" + wpqId).attributes["webpartid"].value;
                    else if (window["ctx"])
                        wpid = window["ctx"].clvp.wpid;

                    var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                    var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                    var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpid));
                    var webpart = webpartDef.get_webPart();
                    var properties = webpart.get_properties();
                    context.load(properties);

                    var setupJsLink = function (properties) {
                        var jsLinkString = (properties.get_item("JSLink") || "") + "|~sitecollection" + path + fileName;
                        if (jsLinkString[0] == '|')
                            jsLinkString = jsLinkString.substr(1);
                        properties.set_item("JSLink", jsLinkString);
                        webpartDef.saveWebPartChanges();
                    };

                    var fatalError = function (sender, args) {
                        console.log('CSREditor fatal error: ' + args.get_message());
                        window["g_Cisar_fileCreationResult"] = "error";
                    };

                    context.executeQueryAsync(function () {
                        var enumerator = files.getEnumerator();
                        var fileExists = false;
                        while (enumerator.moveNext() && !fileExists) {
                            if (enumerator.get_current().get_name().toLowerCase() == fileName.toLowerCase())
                                fileExists = true;
                        }

                        if (fileExists) {
                            var script = document.createElement("script");
                            script.src = _spPageContextInfo.siteAbsoluteUrl + path + fileName;
                            script.type = "text/javascript";
                            document.head.appendChild(script);

                            setupJsLink(properties);

                            context.executeQueryAsync(function () {
                                window["g_Cisar_fileCreationResult"] = "existing";
                                console.log('CSREditor: existing file has been successfully linked to the ' + (formContext ? 'LFWP' : 'XLV') + '.');
                            }, fatalError);
                        } else {
                            var creationInfo = new SP.FileCreationInformation();
                            creationInfo.set_content(new SP.Base64EncodedByteArray());
                            creationInfo.set_url(fileName);
                            var file = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files().add(creationInfo);
                            file.checkIn("Checked in by CSR Editor", SP.CheckinType.majorCheckIn);
                            file.publish("Published by CSR Editor");

                            setupJsLink(properties);

                            context.executeQueryAsync(function () {
                                console.log('CSREditor: file has been created successfully.');
                                window["g_Cisar_fileCreationResult"] = "created";
                            }, fatalError);
                        }
                    }, fatalError);
                });
            }

            if (formContext)
                return {
                    listId: formContext.ListAttributes.Id,
                    isListForm: true,
                    listTemplate: formContext.ListAttributes.ListTemplateType
                };
            else if (window["ctx"])
                return {
                    listId: window["ctx"].listName,
                    listUrl: window["ctx"].listUrlDir,
                    listTitle: window["ctx"].ListTitle,
                    isListForm: false,
                    baseViewId: window["ctx"].BaseViewID,
                    listTemplate: window["ctx"].ListTemplateType
                };
            else
                return null;
        };

        SPActions.checkFileCreated = function () {
            if (window["g_Cisar_fileCreationResult"]) {
                var result = window["g_Cisar_fileCreationResult"];
                delete window["g_Cisar_fileCreationResult"];
                return result;
            } else
                return "wait";
        };

        SPActions.performCSRRefresh = function (url, content) {
            var extend = function (dest, source) {
                for (var p in source) {
                    if (source[p] && source[p].constructor && source[p].constructor === Object) {
                        dest[p] = dest[p] || {};
                        arguments.callee(dest[p], source[p]);
                    } else {
                        dest[p] = source[p];
                    }
                }
                return dest;
            };
            var substract_objects = function (obj1, obj2) {
                for (var p in obj2) {
                    if (Object.prototype.toString.call(obj2[p]) == "[object Array]" && p in obj1)
                        obj1[p] = [];
                    else if (typeof (obj2[p]) == "function" && p in obj1)
                        delete obj1[p];
                    else if (typeof (obj2[p]) == "object" && p in obj1)
                        substract_objects(obj1[p], obj2[p]);
                }
            };

            var formContext = false;
            var wpqId = 2;
            var csrContext = null;
            if (window["SPClientForms"]) {
                while ($get("WebPartWPQ" + wpqId) != null) {
                    if (window["WPQ" + wpqId + "FormCtx"]) {
                        csrContext = window["WPQ" + wpqId + "FormCtx"];
                        formContext = true;
                        break;
                    }
                    wpqId++;
                }
                if (!formContext)
                    return;
            } else if (window["ctx"])
                csrContext = window["ctx"];
            else
                return;

            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);

            if (formContext) {
                var i = 0;
                var rows = document.querySelectorAll("#WebPartWPQ" + wpqId + " .ms-formtable tr .ms-formbody");
                for (var f in csrContext.ListSchema) {
                    if (f == "Attachments" || f == "Created" || f == "Modified" || f == "Author" || f == "Editor")
                        continue;
                    var nodesToReplace = [];
                    for (var n = 0; n < rows[i].childNodes.length; n++)
                        if (rows[i].childNodes[n].nodeType != 8)
                            nodesToReplace.push(rows[i].childNodes[n]);
                    var span = document.createElement("span");
                    span.id = "WPQ" + wpqId + csrContext.ListAttributes.Id + f;
                    rows[i].appendChild(span);
                    for (var n = 0; n < nodesToReplace.length; n++)
                        span.appendChild(nodesToReplace[n]);
                    i++;
                }
            } else
                for (var f in csrContext.ListSchema.Field)
                    delete csrContext.ListSchema.Field[f].fieldRenderer;

            if (window["g_templateOverrides_" + fileName])
                substract_objects(SPClientTemplates.TemplateManager["_TemplateOverrides"], window["g_templateOverrides_" + fileName]);

            var savedRegisterOverridesMethod = SPClientTemplates.TemplateManager.RegisterTemplateOverrides;
            SPClientTemplates.TemplateManager.RegisterTemplateOverrides = function (options) {
                SPClientTemplates.TemplateManager.RegisterTemplateOverrides = savedRegisterOverridesMethod;

                var savedTemplateOverrides = {};
                extend(savedTemplateOverrides, SPClientTemplates.TemplateManager["_TemplateOverrides"]);
                for (var p in SPClientTemplates.TemplateManager["_TemplateOverrides"])
                    SPClientTemplates.TemplateManager["_TemplateOverrides"][p] = {};

                savedRegisterOverridesMethod(options);

                window["g_templateOverrides_" + fileName] = {};
                extend(window["g_templateOverrides_" + fileName], SPClientTemplates.TemplateManager["_TemplateOverrides"]);

                substract_objects(savedTemplateOverrides, { OnPreRender: window["g_templateOverrides_" + fileName].OnPreRender, OnPostRender: window["g_templateOverrides_" + fileName].OnPostRender });

                SPClientTemplates.TemplateManager["_TemplateOverrides"] = savedTemplateOverrides;
                savedRegisterOverridesMethod(options);

                csrContext.DebugMode = true;

                if (formContext)
                    window["SPClientForms"].ClientFormManager.GetClientForm("WPQ" + wpqId).RenderClientForm();
                else
                    window["RenderListView"](window["ctx"], window["ctx"].wpq);

                csrContext.DebugMode = false;
            };

            if (window["ko"] && content.toLowerCase().indexOf("ko.applybindings") > -1) {
                window["ko"].cleanNode(document.body);
            }

            if ($get('csrErrorDiv') != null)
                document.body.removeChild($get('csrErrorDiv'));
            if ($get('csrErrorDivText') != null)
                document.body.removeChild($get('csrErrorDivText'));

            try  {
                eval(content);
            } catch (err) {
                console.log("Error when evaluating the CSR template code!");
                console.log(err);

                var div = document.createElement('div');
                div.id = "csrErrorDiv";
                div.style.backgroundColor = "#300";
                div.style.opacity = "0.5";
                div.style.position = "fixed";
                div.style.top = "0";
                div.style.left = "0";
                div.style.bottom = "0";
                div.style.right = "0";
                div.style.zIndex = "101";
                document.body.appendChild(div);

                var textDiv = document.createElement('div');
                textDiv.id = "csrErrorDivText";
                textDiv.style.position = "fixed";
                textDiv.style.backgroundColor = "#fff";
                textDiv.style.border = "2px solid #000";
                textDiv.style.padding = "10px 15px";
                textDiv.style.width = "300px";
                textDiv.style.top = "200px";
                textDiv.style.left = "0";
                textDiv.style.right = "0";
                textDiv.style.margin = "0 auto";
                textDiv.style.zIndex = "102";
                textDiv.innerHTML = "Error when evaluating the CSR template code: " + err["message"];
                document.body.appendChild(textDiv);
            } finally {
                SPClientTemplates.TemplateManager.RegisterTemplateOverrides = savedRegisterOverridesMethod;
            }
        };

        SPActions.saveFileToSharePoint = function (url, content64) {
            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);

            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();

                var saveInfo = new SP.FileSaveBinaryInformation();
                saveInfo.set_content(new SP.Base64EncodedByteArray(content64));

                var file = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files().getByUrl(fileName);
                file.checkOut();
                file.saveBinary(saveInfo);
                file.checkIn("Checked in by CSR Editor", SP.CheckinType.majorCheckIn);
                file.publish("Published by CSR Editor");

                context.executeQueryAsync(function () {
                    console.log('CSREditor: file saved successfully.');
                }, function (sender, args) {
                    console.log('CSREditor fatal error when saving file ' + fileName + ': ' + args.get_message());
                });
            });
        };

        SPActions.removeFileFromSharePoint = function (url) {
            var wpqId = 2;
            var formContext = null;
            while ($get("WebPartWPQ" + wpqId) != null) {
                if (window["WPQ" + wpqId + "FormCtx"]) {
                    formContext = window["WPQ" + wpqId + "FormCtx"];
                    break;
                }
                wpqId++;
            }

            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);

            if (formContext || window["ctx"]) {
                SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                    var wpid;
                    if (formContext)
                        wpid = $get("WebPartWPQ" + wpqId).attributes["webpartid"].value;
                    else if (window["ctx"])
                        wpid = window["ctx"].clvp.wpid;

                    var context = SP.ClientContext.get_current();

                    context.get_site().get_rootWeb().getFileByServerRelativeUrl(url).recycle();

                    var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                    var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                    var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpid));
                    var webpart = webpartDef.get_webPart();
                    var properties = webpart.get_properties();
                    context.load(properties);

                    context.executeQueryAsync(function () {
                        var jsLinkString = properties.get_item("JSLink").replace("|~sitecollection" + url, "").replace("~sitecollection" + url + "|", "").replace("~sitecollection" + url, "").replace("|~sitecollection" + url.replace('%20', ' '), "").replace("~sitecollection" + url.replace('%20', ' ') + "|", "").replace("~sitecollection" + url.replace('%20', ' '), "");
                        properties.set_item("JSLink", jsLinkString);
                        webpartDef.saveWebPartChanges();
                        context.executeQueryAsync(function () {
                            console.log('CSREditor: file ' + fileName + ' was successfully moved to recycle bin and removed from the XLV/LFWP.');
                        }, function (sender, args) {
                            console.log('CSREditor error when unlinking file ' + fileName + ' from the XLV/LFWP: ' + args.get_message());
                        });
                    }, function (sender, args) {
                        console.log('CSREditor fatal error when saving file ' + fileName + ': ' + args.get_message());
                    });
                });
            }
        };
        return SPActions;
    })();
    CSREditor.SPActions = SPActions;
})(CSREditor || (CSREditor = {}));
var CSREditor;
(function (CSREditor) {
    var TypeScriptServiceHost = (function () {
        function TypeScriptServiceHost(libText) {
            this.scriptVersion = 0;
            this.libText = "";
            this.libTextLength = 0;
            this.text = "";
            this.changes = [];
            this.libText = libText;
            this.libTextLength = libText.length;
        }
        TypeScriptServiceHost.prototype.log = function (message) {
            console.log("tsHost: " + message);
        };
        TypeScriptServiceHost.prototype.information = function () {
            return true;
        };
        TypeScriptServiceHost.prototype.debug = function () {
            return true;
        };
        TypeScriptServiceHost.prototype.warning = function () {
            return true;
        };
        TypeScriptServiceHost.prototype.error = function () {
            return true;
        };
        TypeScriptServiceHost.prototype.fatal = function () {
            return true;
        };
        TypeScriptServiceHost.prototype.getCompilationSettings = function () {
            return "{ \"noLib\": true }";
        };
        TypeScriptServiceHost.prototype.getScriptFileNames = function () {
            return "[\"csr-editor.ts\", \"libs.ts\"]";
        };
        TypeScriptServiceHost.prototype.getScriptVersion = function (fn) {
            if (fn == 'libs.ts')
                return 0;
            else
                return this.scriptVersion;
        };
        TypeScriptServiceHost.prototype.getScriptIsOpen = function (fn) {
            return true;
        };
        TypeScriptServiceHost.prototype.getLocalizedDiagnosticMessages = function () {
            return "";
        };
        TypeScriptServiceHost.prototype.getCancellationToken = function () {
            return null;
        };
        TypeScriptServiceHost.prototype.getScriptByteOrderMark = function (fn) {
            return 0;
        };

        TypeScriptServiceHost.prototype.resolveRelativePath = function () {
            return null;
        };
        TypeScriptServiceHost.prototype.fileExists = function (fn) {
            return null;
        };
        TypeScriptServiceHost.prototype.directoryExists = function (dir) {
            return null;
        };
        TypeScriptServiceHost.prototype.getParentDirectory = function (dir) {
            return null;
        };
        TypeScriptServiceHost.prototype.getDiagnosticsObject = function () {
            return null;
        };

        TypeScriptServiceHost.prototype.getScriptSnapshot = function (fn) {
            var snapshot, snapshotChanges, snapshotVersion;
            if (fn == 'libs.ts') {
                snapshot = TypeScript.ScriptSnapshot.fromString(this.libText);
                snapshotChanges = [];
                snapshotVersion = 0;
            } else {
                snapshot = TypeScript.ScriptSnapshot.fromString(this.text);
                snapshotChanges = this.changes;
                snapshotVersion = this.scriptVersion;
            }
            return {
                getText: function (s, e) {
                    return snapshot.getText(s, e);
                },
                getLength: function () {
                    return snapshot.getLength();
                },
                getLineStartPositions: function () {
                    return "[" + snapshot.getLineStartPositions().toString() + "]";
                },
                getTextChangeRangeSinceVersion: function (version) {
                    if (snapshotVersion == 0)
                        return null;
                    var result = TypeScript.TextChangeRange.collapseChangesAcrossMultipleVersions(snapshotChanges.slice(version - snapshotVersion));
                    return "{ \"span\": { \"start\": " + result.span().start() + ", \"length\": " + result.span().length() + " }, \"newLength\": " + result.newLength() + " }";
                }
            };
        };

        TypeScriptServiceHost.prototype.getLibLength = function () {
            return this.libTextLength;
        };
        TypeScriptServiceHost.prototype.scriptChanged = function (newText, startPos, changeLength) {
            this.scriptVersion++;
            this.text = newText;
            this.changes.push(new TypeScript.TextChangeRange(new TypeScript.TextSpan(startPos, changeLength), newText.length));
        };
        return TypeScriptServiceHost;
    })();

    var TypeScriptService = (function () {
        function TypeScriptService() {
            var self = this;
            var client = new XMLHttpRequest();
            client.open('GET', 'Scripts/typings/libs.d.ts');
            client.onreadystatechange = function () {
                if (client.readyState != 4)
                    return;

                self.tsHost = new TypeScriptServiceHost(client.responseText);
                var tsFactory = new TypeScript.Services.TypeScriptServicesFactory();
                self.tsServiceShim = tsFactory.createLanguageServiceShim(self.tsHost);
            };
            client.send();
        }
        TypeScriptService.prototype.scriptChanged = function (newText, startPos, changeLength) {
            this.tsHost.scriptChanged(newText, startPos, changeLength);
        };

        TypeScriptService.prototype.getCompletions = function (position) {
            return this.tsServiceShim.languageService.getCompletionsAtPosition('csr-editor.ts', position, true);
        };

        TypeScriptService.prototype.getCompletionDetails = function (position, name) {
            return this.tsServiceShim.languageService.getCompletionEntryDetails('csr-editor.ts', position, name);
        };

        TypeScriptService.prototype.getSignature = function (position) {
            return this.tsServiceShim.languageService.getSignatureAtPosition('csr-editor.ts', position);
        };

        TypeScriptService.prototype.getErrors = function () {
            var syntastic = this.tsServiceShim.languageService.getSyntacticDiagnostics('csr-editor.ts');
            var semantic = this.tsServiceShim.languageService.getSemanticDiagnostics('csr-editor.ts');
            return syntastic.concat(semantic);
        };
        return TypeScriptService;
    })();
    CSREditor.TypeScriptService = TypeScriptService;
})(CSREditor || (CSREditor = {}));
//# sourceMappingURL=csr-editor.js.map
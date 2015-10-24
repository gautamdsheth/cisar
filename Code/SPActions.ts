﻿var B64: any;

module CSREditor {

    export class SPActions {

        public static getCode_listCsrWebparts() {
            return "(" + SPActions.listCsrWebparts + ")();";
        }

        private static listCsrWebparts() {
            var controlModeTitle = { '1': 'DisplayForm', '2': 'EditForm', '3': 'NewForm' };

            var context = SP.ClientContext.get_current();
            var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
            var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);

            var webparts = [];
            var wp_properties = [];
            var wpqId = 2;
            while ($get("WebPartWPQ" + wpqId) != null) {
                var wpId = $get("WebPartWPQ" + wpqId).attributes["webpartid"].value;
                if (window["WPQ" + wpqId + "FormCtx"]) {

                    var ctx = window["WPQ" + wpqId + "FormCtx"];

                    // add fields to context
                    var fields = [];
                    for (var f in ctx.FieldControlModes) {

                        if (f == "Attachments" || f == "Created" || f == "Modified" || f == "Author" || f == "Editor" || f == "_UIVersionString")
                            continue;

                        fields.push(f);
                    }

                    webparts.push({
                        title: controlModeTitle[ctx.FormControlMode] + ': ' + (ctx.ItemAttributes.Url || ctx.NewItemRootFolder),
                        wpqId: wpqId,
                        wpId: wpId,
                        isListForm: true,
                        ctxKey: "WPQ" + wpqId + "FormCtx",
                        listTemplateType: ctx.ListAttributes.ListTemplateType,
                        fields: fields
                    });

                    var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpId));
                    var webpart = webpartDef.get_webPart();
                    var properties = webpart.get_properties();
                    context.load(properties);
                    wp_properties.push({ wpqId: wpqId, properties: properties });

                } else if (window["WPQ" + wpqId + "SchemaData"]) {

                    var ctxNumber = window["g_ViewIdToViewCounterMap"][window["WPQ" + wpqId + "SchemaData"].View];
                    var ctx = window["ctx" + ctxNumber];

                    webparts.push({
                        title: 'View: ' + ctx.ListTitle,
                        wpqId: wpqId,
                        wpId: wpId,
                        isListForm: false,
                        ctxKey: 'ctx' + ctxNumber,
                        baseViewId: ctx.BaseViewId,
                        listTemplateType: ctx.ListTemplateType
                    });

                    var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpId));
                    var webpart = webpartDef.get_webPart();
                    var properties = webpart.get_properties();
                    context.load(properties);
                    wp_properties.push({ wpqId: wpqId, properties: properties });

                }
                wpqId++;
            }

            delete window["g_Cisar_JSLinkUrls"];
            context.executeQueryAsync(
                function () {
                    var urls = {};
                    for (var i = 0; i < wp_properties.length; i++) {
                        var urlsString = wp_properties[i].properties.get_item('JSLink') || '';
                        if (urlsString != '') {
                            var urlsArray = urlsString.split('|');
                            for (var x = 0; x < urlsArray.length; x++) {
                                urlsArray[x] = SPClientTemplates.Utility.ReplaceUrlTokens(urlsArray[x]);
                            }
                            urls[wp_properties[i].wpqId] = urlsArray;
                        }
                    }
                    window["g_Cisar_JSLinkUrls"] = urls;
                },
                function (s, args) {
                    console.log('Error when retrieving properties for the CSR webparts on the page: ' + args.get_message());
                    window["g_Cisar_JSLinkUrls"] = 'error';
                })

            return webparts;
        }


        public static getCode_checkJSLinkInfoRetrieved() {
            return "(" + SPActions.checkJSLinkInfoRetrieved + ")();";
        }
        private static checkJSLinkInfoRetrieved() {
            if (window["g_Cisar_JSLinkUrls"]) {
                var result = window["g_Cisar_JSLinkUrls"];
                delete window["g_Cisar_JSLinkUrls"];
                return result;
            }
            else
                return "wait";
        }

        public static getCode_retrieveFieldsInfo(ctxKey: string) {
            return "(" + SPActions.retrieveFieldsInfo + ")('" + ctxKey  + "');";
        }

        private static retrieveFieldsInfo(ctxKey) {
            return window[ctxKey].ListSchema.Field || window[ctxKey].ListSchema;
        }


        public static getCode_createFileInSharePoint(path: string, fileName: string, wpId: string, ctxKey: string) {
            return "(" + SPActions.createFileInSharePoint + ")('" + path + "', '" + fileName + "', '" + wpId + "', '" + ctxKey + "');";
        }
        private static createFileInSharePoint(path: string, fileName: string, wpId: string, ctxKey: string) {
            path = path.replace('%20', ' ');
            var fullPath = path;
            if (_spPageContextInfo.siteServerRelativeUrl != '/')
                fullPath = _spPageContextInfo.siteServerRelativeUrl + path;

            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();

                var files = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(fullPath).get_files();
                context.load(files, "Include(Name)");

                var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpId));
                var webpart = webpartDef.get_webPart();
                var properties = webpart.get_properties();
                context.load(properties);
                    
                var setupJsLink = function (properties) {
                    var jsLinkString = (properties.get_item("JSLink") || "") + "|~sitecollection" + path + fileName;
                    if (jsLinkString[0] == '|')
                        jsLinkString = jsLinkString.substr(1);
                    properties.set_item("JSLink", jsLinkString);
                    webpartDef.saveWebPartChanges();
                }

                var fatalError = function (sender, args) {
                    console.log('Cisar fatal error when creating ' + fullPath + ': ' + args.get_message());
                    window["g_Cisar_fileCreationResult"] = "error";
                }

                context.executeQueryAsync(function () {

                    var enumerator = files.getEnumerator();
                    var fileExists = false;
                    while (enumerator.moveNext() && !fileExists) {
                        if (enumerator.get_current().get_name().toLowerCase() == fileName.toLowerCase())
                            fileExists = true;
                    }

                    if (fileExists) {

                        var script = document.createElement("script");
                        script.src = fullPath + fileName;
                        script.type = "text/javascript";
                        document.head.appendChild(script);

                        setupJsLink(properties);

                        context.executeQueryAsync(function () {
                            window["g_Cisar_fileCreationResult"] = "existing";
                            console.log('CSREditor: existing file has been successfully linked to the webpart.');
                        },
                        fatalError);

                    } else {

                        var creationInfo = new SP.FileCreationInformation();
                        creationInfo.set_content(new SP.Base64EncodedByteArray());
                        creationInfo.set_url(fileName);
                        var file = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(fullPath).get_files().add(creationInfo);
                        context.load(file, 'CheckOutType');

                        setupJsLink(properties);

                        context.executeQueryAsync(function () {
                            console.log('Cisar: file has been created successfully.');
                            window["g_Cisar_fileCreationResult"] = "created";
                            if (file.get_checkOutType() != SP.CheckOutType.none) {
                                file.checkIn("Checked in by Cisar", SP.CheckinType.minorCheckIn);
                                context.executeQueryAsync(function () {
                                    console.log('Cisar: file has been checked in successfully.');
                                }, fatalError);
                            }
                        },
                        fatalError);

                    }
                },
                fatalError);
            });
        }

        public static getCode_checkFileCreated() {
            return "(" + SPActions.checkFileCreated + ")();";
        }
        private static checkFileCreated() {
            if (window["g_Cisar_fileCreationResult"]) {
                var result = window["g_Cisar_fileCreationResult"];
                delete window["g_Cisar_fileCreationResult"];
                return result;
            }
            else
                return "wait";
        }


        public static getCode_performCSRRefresh(url: string, content: string) {
            return "(" + SPActions.performCSRRefresh + ")('" + url + "', '" + content + "');";
        }
        private static performCSRRefresh(url: string, content: string) {
            
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

            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);

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

                var wpqId = 2;
                while ($get("WebPartWPQ" + wpqId) != null) {
                    var wpId = $get("WebPartWPQ" + wpqId).attributes["webpartid"].value;
                    if (window["WPQ" + wpqId + "FormCtx"]) {

                        var ctx = window["WPQ" + wpqId + "FormCtx"];
                        var i = 0;
                        var rows = document.querySelectorAll("#WebPartWPQ" + wpqId + " .ms-formtable tr .ms-formbody");
                        for (var f in ctx.ListSchema) {
                            if (f == "Attachments" || f == "Created" || f == "Modified" || f == "Author" || f == "Editor" || f == "_UIVersionString")
                                continue;
                            var nodesToReplace = [];
                            for (var n = 0; n < rows[i].childNodes.length; n++)
                                if (rows[i].childNodes[n].nodeType != 8)
                                    nodesToReplace.push(rows[i].childNodes[n]);
                            var span = document.createElement("span");
                            span.id = "WPQ" + wpqId + ctx.ListAttributes.Id + f;
                            rows[i].appendChild(span);
                            for (var n = 0; n < nodesToReplace.length; n++)
                                span.appendChild(nodesToReplace[n]);
                            i++;
                        }

                        window["SPClientForms"].ClientFormManager.GetClientForm("WPQ" + wpqId).RenderClientForm();

                    } else if (window["WPQ" + wpqId + "SchemaData"]) {

                        var ctxNumber = window["g_ViewIdToViewCounterMap"][window["WPQ" + wpqId + "SchemaData"].View];
                        var ctx = window["ctx" + ctxNumber];
                        for (var f in ctx.ListSchema.Field)
                            delete ctx.ListSchema.Field[f].fieldRenderer;
                        ctx.DebugMode = true;
                        if (ctx.inGridMode) {
                            var searchDiv = $get("inplaceSearchDiv_WPQ" + wpqId);
                            searchDiv.parentNode.removeChild(searchDiv);
                            var gridInitInfo = window["g_SPGridInitInfo"][ctx.view];
                            gridInitInfo.initialized = false;
                            window["InitGrid"](gridInitInfo, ctx, false);
                        }
                        else
                            window["RenderListView"](ctx, ctx.wpq);
                    }
                    wpqId++;
                }

            }

            if (window["ko"] && content.toLowerCase().indexOf("ko.applybindings") > -1) {
                window["ko"].cleanNode(document.body);
            }

            if ($get('csrErrorDiv') != null)
                document.body.removeChild($get('csrErrorDiv'));
            if ($get('csrErrorDivText') != null)
                document.body.removeChild($get('csrErrorDivText'));

            try {
                eval(content);
            }
            catch (err) {
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
            }
            finally {
                SPClientTemplates.TemplateManager.RegisterTemplateOverrides = savedRegisterOverridesMethod;
            }
        }

        public static getCode_saveFileToSharePoint(url: string, content64: string) {
            return "(" + SPActions.saveFileToSharePoint + ")('" + url + "', '" + content64 + "');";
        }
        private static saveFileToSharePoint(url: string, content64: string) {

            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);

            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();

                var saveInfo = new SP.FileSaveBinaryInformation();
                saveInfo.set_content(new SP.Base64EncodedByteArray(content64));

                var file = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files().getByUrl(fileName);
                file.checkOut();
                file.saveBinary(saveInfo);
                file.checkIn("Checked in by Cisar", SP.CheckinType.minorCheckIn);

                context.executeQueryAsync(function () {
                    console.log('Cisar: file saved successfully.');
                    window["g_Cisar_fileSavingResult"] = "saved";
                },
                function (sender, args) {
                    console.log('Cisar fatal error when saving file ' + fileName + ' to path "' + path + '": ' + args.get_message());
                    window["g_Cisar_fileSavingResult"] = "error";
                });
            });
        }

        public static getCode_checkFileSaved() {
            return "(" + SPActions.checkFileSaved + ")();";
        }
        private static checkFileSaved() {
            if (window["g_Cisar_fileSavingResult"]) {
                var result = window["g_Cisar_fileSavingResult"];
                delete window["g_Cisar_fileSavingResult"];
                return result;
            }
            else
                return "wait";
        }

        public static getCode_publishFileToSharePoint(url: string) {
            return "(" + SPActions.publishFileToSharePoint + ")('" + url + "');";
        }
        private static publishFileToSharePoint(url: string) {

            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);

            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();

                var file = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files().getByUrl(fileName);
                context.load(file, 'Level', 'CheckOutType');

                context.executeQueryAsync(function () {
                    context.load(file, 'Level', 'CheckOutType');
                    if (file.get_checkOutType() != SP.CheckOutType.none && file.get_level() == SP.FileLevel.draft) {
                        file.publish("Published by Cisar");

                        context.executeQueryAsync(function () {
                            console.log('Cisar: file has been published successfully.');
                        },
                        function (sender, args) {
                            console.log('Cisar fatal error when publishing file ' + fileName + ': ' + args.get_message());
                        });
                    }
                    console.log('Cisar: file published successfully.');
                },
                function (sender, args) {
                    console.log('Cisar fatal error when publishing file ' + fileName + ' to path "' + path + '": ' + args.get_message());
                });
            });
        }

        public static getCode_removeFileFromSharePoint(url: string, wpId: string) {
            return "(" + SPActions.removeFileFromSharePoint + ")('" + url + "', '" + wpId + "');";
        }
        private static removeFileFromSharePoint(url: string, wpId: string) {
            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);

            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();

                context.get_site().get_rootWeb().getFileByServerRelativeUrl(url).recycle();

                var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpId));
                var webpart = webpartDef.get_webPart();
                var properties = webpart.get_properties();
                context.load(properties);

                context.executeQueryAsync(function () {
                    var oldJsLinkString = properties.get_item("JSLink");
                    url = url.replace(_spPageContextInfo.siteServerRelativeUrl, '');
                    if (url[0] != '/')
                        url = '/' + url;
                    var jsLinkString = properties.get_item("JSLink")
                        .replace("|~sitecollection" + url, "")
                        .replace("~sitecollection" + url + "|", "")
                        .replace("~sitecollection" + url, "")
                        .replace("|~sitecollection" + url.replace('%20', ' '), "")
                        .replace("~sitecollection" + url.replace('%20', ' ') + "|", "")
                        .replace("~sitecollection" + url.replace('%20', ' '), "");
                    if (jsLinkString == oldJsLinkString) {
                        console.log('Cisar: ERROR, cannot remove ' + url + ' from ' + jsLinkString + '. Please edit page and remove this file manually.');
                        return;
                    }
                    properties.set_item("JSLink", jsLinkString);
                    webpartDef.saveWebPartChanges();
                    context.executeQueryAsync(function () {
                        console.log('Cisar: file ' + fileName + ' was successfully moved to recycle bin and removed from the XLV/LFWP.');
                    },
                    function (sender, args) {
                        console.log('Cisar error when unlinking file ' + fileName + ' from the XLV/LFWP: ' + args.get_message());
                    });
                },
                function (sender, args) {
                    console.log('Cisar fatal error when saving file ' + fileName + ': ' + args.get_message());
                });
            });

        }


        public static getCode_getFileContent(url: string) {
            return "(" + SPActions.getFileContent + ")('" + url + "');";
        }
        private static getFileContent(url: string) {
            delete window["g_Cisar_FileContents"];
            url = url.replace(_spPageContextInfo.siteServerRelativeUrl, '');
            if (url[0] != '/')
                url = '/' + url;
            var r = new Sys.Net.WebRequest();
            r.set_url(_spPageContextInfo.siteAbsoluteUrl + url);
            r.set_httpVerb("GET");
            r.add_completed((executor, args) => {
                if (executor.get_responseAvailable()) {
                    window["g_Cisar_FileContents"] = executor.get_responseData();
                }
                else {
                    if (executor.get_timedOut() || executor.get_aborted())
                        window["g_Cisar_FileContents"] = "error";
                }
            });
            r.invoke();
        }


        public static getCode_checkFileContentRetrieved() {
            return "(" + SPActions.checkFileContentRetrieved + ")();";
        }
        private static checkFileContentRetrieved() {
            if (window["g_Cisar_FileContents"]) {
                var result = window["g_Cisar_FileContents"];
                delete window["g_Cisar_FileContents"];
                return result;
            }
            else
                return "wait";
        }

    }

}

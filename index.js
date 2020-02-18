// 修改原生EventTarget对象
function modifyEventTarget (destWindow) {
    // 跨域异常-crossOrigin
    const originAddEventListener = destWindow.EventTarget.prototype.addEventListener;
    destWindow.EventTarget.prototype.addEventListener = function (type, listener, options) {
        const wrappedListener = function (...args) {
            try {
                return listener.apply(this, args);
            }
            catch (err) {
                throw err;
            }
        };
        return originAddEventListener.call(destWindow, type, wrappedListener, options);
    };
}

// 修改原生XMLHttpRequest
function hookAjax (proxy, destWindow = window) {
    const realXhr = "RealXMLHttpRequest";
    destWindow[realXhr] = destWindow[realXhr] || destWindow.XMLHttpRequest;

    destWindow.XMLHttpRequest = function () {
        const xhr = new destWindow[realXhr];
        for (const attr in xhr) {
            let type = "";
            try {
                type = typeof xhr[attr];
            } catch (e) {
            }
            if (type === "function") {
                this[attr] = hookFunction(attr);
            } else {
                Object.defineProperty(this, attr, {
                    get: getterFactory(attr),
                    set: setterFactory(attr),
                    enumerable: true
                });
            }
        }
        this.xhr = xhr;

    };

    function getterFactory(attr) {
        return function () {
            const v = this.hasOwnProperty(attr + "_") ? this[attr + "_"] : this.xhr[attr];
            const attrGetterHook = (proxy[attr] || {})["getter"];
            return attrGetterHook && attrGetterHook(v, this) || v
        }
    }

    function setterFactory(attr) {
        return function (v) {
            const xhr = this.xhr;
            const that = this;
            const hook = proxy[attr];
            if (typeof hook === "function") {
                xhr[attr] = function () {
                    proxy[attr](that) || v.apply(xhr, arguments);
                }
            } else {
                const attrSetterHook = (hook || {})["setter"];
                v = attrSetterHook && attrSetterHook(v, that) || v
                try {
                    xhr[attr] = v;
                } catch (e) {
                    this[attr + "_"] = v;
                }
            }
        }
    }

    function hookFunction(fun) {
        return function () {
            const args = [].slice.call(arguments);
            if (proxy[fun] && proxy[fun].call(this, args, this.xhr)) {
                return;
            }
            return this.xhr[fun].apply(this.xhr, args);
        }
    }

    return destWindow[realXhr];
}

class ErrorTracker {
    constructor() {
        this.errorBox = [];
    }

    init() {
        this.handleWindow(window);
    }

    getErrors() {
        return this.errorBox;
    }

    handleWindow(destWindow) {
        const _instance = this;
        modifyEventTarget(destWindow);

        // XHR错误（利用http status code判断）
        hookAjax({
            onreadystatechange: xhr => {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 400 || xhr.status <= 599) {
                        console.log('xhr错误：', xhr);
                        const error = xhr.xhr;
                        _instance.errorBox.push(new FEError(`api response ${error.status}`, error.responseURL, null, null, error.responseText));
                    }
                }
            }
        }, destWindow);

        // 全局JS异常-window.onerror / 全局静态资源异常-window.addEventListener
        destWindow.addEventListener('error', event => {
            event.preventDefault();
            console.log('errorEvent错误:', event);
            if (event instanceof destWindow.ErrorEvent) {
                _instance.errorBox.push(new FEError(event.message, event.filename, event.lineno, event.colno, event.error));
            }
            else if (event instanceof destWindow.Event) {
                if (event.target instanceof HTMLImageElement) {
                    _instance.errorBox.push(new FEError('load img error', event.target.src, null, null, null));
                }
            }
            return true;
        }, true);

        // 没有catch等promise异常-unhandledrejection
        destWindow.addEventListener('unhandledrejection', event => {
            event.preventDefault();
            console.log('unhandledrejection错误:', event);
            _instance.errorBox.push(new FEError('unhandled rejection', null, null, null, event.reason));
            return true;
        });

        // 页面嵌套错误（iframe错误等等、单点登录）（注意：不能捕获iframe加载时的错误）
        destWindow.addEventListener('load', () => {
            const iframes = destWindow.document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                _instance.handleWindow(iframe.contentWindow);
            });
        });
    }
}

class FEError {
    constructor(message, source, lineno, colno, stack) {
        this.message = message;
        this.source = source;
        this.lineno = lineno;
        this.colno = colno;
        this.stack = stack;
        this.time = new Date();
    }
}

export default ErrorTracker;

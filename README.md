# web-error-tracker
前端错误收集器
An error tracker for web project.
自动收集Web前端错误，可`npm安装` 或者直接 `文件引用方式`

#### npm包方式
* 安装依赖
    * `yarn add web-error-tracker`
    * 或者`npm install web-error-tracker`
* 初始化
    ```
      import ErrorTracker from 'web-error-tracker';
      const errorTracker = new ErrorTracker();
      errorTracker.init();
    ```
* 获取当前收集到的错误
    ```
      console.log(errorTracker.getErrors());
    ```

#### 文件引用方式
* 引入
    ```
    // html
    <body>
    ...
    ...
    ...
    
    // 在body的最后引入
    <script src="https://github.com/evilrescuer/web-error-tracker/blob/master/index-file.js"></script>
    </body>
    ```
* 获取当前收集到的错误
    ```
      console.log(window.errorTracker.getErrors());
    ```


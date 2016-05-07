
var    gulp = require('gulp');
          http = require('http'),
         post = require('http-post'),
             fs = require('fs'),
download = require("gulp-download-stream"),
imageResize = require('gulp-image-resize'),
   parallel = require("concurrent-transform"),
   os = require('os'),
   rename = require('gulp-rename'),
   del = require('del'),
   child = require('child_process'),
   copy = require('copy'),
   Q = require('q'),
   moment = require('moment'),
   XLSX = require('xlsx'),
   later = require('later'),
   express = require('express'),
   bodyParser = require('body-parser'),
   multer = require('multer'),
   util  = require('util'),
   spawn = require('child_process').spawn;
   // gu = spawn('gulp');

var jsondata,
        urlArray = new Array(),
        start = '2015-01-01 00:00:00',
        end = '2016-04-22 00:00:00',
        duringTime = {
          starttime: start,
          endtime: end
        }

var app = express();

app.use(express.static('public'));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
// app.use(multer()); // for parsing multipart/form-data

app.get('/', function (req, res) {
  // res.send('Hello World!');
});
app.post("/", function(req, res){
  res.json(req.body);
  duringTime.starttime = req.body.starttime;
  duringTime.endtime = req.body.endtime;
  console.log('post了数据');
  child.exec('rm -rf tempic');
  child.exec('pkill gulp');
  gulp.start('default');
});


var server = app.listen(3000, function (req, res){
  console.log("程序正在运行......");
  // gulp.start('default');
});

gulp.task('post', function(){
  console.log("我被执行了");
  var workbook = XLSX.readFile('./pic1/pic1.xlsx');
  var numofO = +workbook.Sheets['orderInfo']['!ref'].slice(-1);
  var orderArray = new Array();
  var sheet = workbook.Sheets['orderInfo'];
  for(var i = 2;i <= numofO;i ++){
    var order = new Object();
    var orderid = sheet['A'+i].v;
    var temA = orderid.split('');
    temA.splice(0,1);
    temA.splice(-1);
    orderid = temA.join('');
    var flagstr = sheet['B'+i].v;
    order.OrderID = orderid.toString().trim();
    order.flagstr = flagstr.toString().trim();
    //此处判断是否加入post数组
    orderArray.push(order);
  }
  for(var  i = 0;i < orderArray.length;i ++){
    post("http://119.254.111.193/index.php/Home/API/UpdataOrderById", orderArray[i], function(res){});
  }
});

gulp.task("getJson",  ['post'], function(callback){
  post("http://119.254.111.193/index.php/Home/API/readOrderByTime", duringTime, function(res){
      var body = "";
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function(){
        jsondata = JSON.parse(body);
        var temArray = new Array();        
        for(var data in jsondata){
          temArray = [];
          if(typeof jsondata[data] == 'object' && jsondata[data] != null) {
            //上线时此处要改
            if(jsondata[data].wearl && jsondata[data].wearr && jsondata[data].orderid) {
              temArray.push(jsondata[data].orderid);
              temArray.push(jsondata[data].cmunber);
              temArray.push(jsondata[data].wearl);
              temArray.push(jsondata[data].wearr);
              urlArray.push(temArray);
            }
          }
        }
	// console.log(urlArray);
       callback();
        // console.log(jsondata);
      });
  });
});

gulp.task('down', ['getJson'],function(){
  if(urlArray.length === 0){
  	child.exec('pkill gulp');
  	// setTimeout(function(){
   //        console.log("3");
   //        gulp.start('default');
  	// }, 20000);
  }
  var  deferred = Q.defer();
  fs.mkdirSync('tempic');
  for(var i = 0;i < urlArray.length;i ++){
    var dirname = urlArray[i][0];
    //输出信息
    fs.mkdirSync('tempic/' + dirname);
    download([urlArray[i][2], urlArray[i][3]])
    .pipe(gulp.dest('tempic/' + dirname));
  }
  setTimeout(function(){
    deferred.resolve();
  }, 20000);
  return deferred.promise;
});

gulp.task('deal', ['down'], function(){
  var deferred = Q.defer();
  for(var i = 0;i < urlArray.length;i ++){
    gulp.src("tempic/" + urlArray[i][0] + "/*.*")
    .pipe(imageResize({height: 800}))
    .pipe(gulp.dest("tempic/" + urlArray[i][0]));
  }
  setTimeout(function(){
    deferred.resolve();
  }, 20000);
  return deferred.promise;
});

gulp.task('distri', ['deal'], function(cb){
  var fileC = urlArray.length,
  average = Math.ceil(fileC/5),
       lastN = fileC - average*4,
    dArray = ['pic1', 'pic2', 'pic3', 'pic4', 'pic5'];
  for(var i = 0;i < fileC;i ++){
    if(i < average) {
      dst = dArray[0];
    }
    else if(i >= average && i < average*2) {
      dst = dArray[1];
    }
    else if(i >= average*2 && i < average*3) {
      dst = dArray[2];
    }
    else if(i >= average*3 && i < average*4) {
      dst = dArray[3];
    }
    else {
      dst = dArray[4];
    }
    copy('tempic/' + urlArray[i][0] + '/*.*', dst, function(err){
      if(err)
        console.log(err);
    });
  }
  cb();
});

gulp.task('backup', ['distri'], function(){
  var  deferred = Q.defer();
  var time = moment().format("YYYY-MM-DD HH:mm:ss");
  var dst = 'downrecord/' + time;
  fs.mkdirSync(dst);
  for(var i = 0;i < urlArray.length;i ++){
    copy('tempic/' + urlArray[i][0] + '/*.*', dst, function(err){
      if(err)
        console.log(err);
    });
  }
  setTimeout(function(){
    deferred.resolve();
  }, 20000);
  return deferred.promise;
})

gulp.task('del', ['backup'], function(cb){
  child.exec('rm -r tempic', function(err, out){
    if(err)
      console.log(err);
  });
  cb();
});

gulp.task('backupXLSX', ['del'], function(){
  var  deferred = Q.defer();
  var dirArray = ['pic1', 'pic2', 'pic3', 'pic4', 'pic5'];
  var dst = 'xlsxrecord';
  for(var i = 0;i < dirArray.length;i ++){
    copy(dirArray[i] + '/*.xlsx', dst, function(err){
      if(err)
        console.log(err);
    });
  }
  setTimeout(function(){
    deferred.resolve();
  }, 20000);
  return deferred.promise;
});

gulp.task('default', function(){
  //server.close();
  child.exec('rm -rf tempic');
  gulp.start('backupXLSX');
  console.log("1");

  var sched = later.parse.text('every 1 mins'),
         t = later.setInterval(function() {
            console.log("2");
            child.exec('rm -rf tempic');
            start = end;
            end = moment().minute(moment().minute() + 2).format("YYYY-MM-DD HH:mm:ss");
            duringTime.starttime = start;
            duringTime.endtime = end;
            gulp.start('backupXLSX');
         }, sched);
});









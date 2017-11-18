//     Underscore.js 1.8.2
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.


//PS: 参考： http://www.css88.com/doc/underscore1.8.2/#groupBy
//           https://github.com/hanzichi/underscore-analysis/blob/master/underscore-1.8.3.js/underscore-1.8.3-analysis.js            


(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  // 以下均针对 OOP 形式的调用
  // _(obj)

  // 如果是非 OOP 形式的调用，不会进入该函数内部

  // 如果 obj 已经是 `_` 函数的实例，则直接返回 obj
  //参考https://github.com/hanzichi/underscore-analysis/issues/27
  //现在我们已经明确以下两点：

  //_ 是一个函数（支持无 new 调用的构造函数）
  //_ 的属性有很多方法，比如 _.each，_.template 等等
  //我们的目标是让 _ 的构造实例也能调用这些方法
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
   // 将上面定义的 `_` 局部变量赋值给全局对象中的 `_` 属性
  // 即客户端中 window._ = _
  // 服务端(node)中 exports._ = _
  // 同时在服务端向后兼容老的 require() API
  // 这样暴露给全局后便可以在全局环境中使用 `_` 变量(方法)
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.2';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  // underscore 内部方法
  // 根据 this 指向（context 参数）
  // 以及 argCount 参数
  // 二次操作返回一些回调、迭代方法
  var optimizeCb = function(func, context, argCount) {
    // 如果没有指定 this 指向，则返回原函数
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      // 如果有指定 this，但没有传入 argCount 参数
      // 则执行以下 case
      // _.each、_.map
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
       // _.reduce、_.reduceRight
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

 

  // An internal function for creating a new object that inherits from another.
  //创建一个新的内部函数来继承其他的
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};//如果不是对象，返回{}
    if (nativeCreate) return nativeCreate(prototype);//es6 Object.create
    Ctor.prototype = prototype;//{}.prototype
    var result = new Ctor; //新实例
    Ctor.prototype = null;
    return result;
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Math.pow(2, 53) - 1 是 JavaScript 中能精确表示的最大数字
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  //类数组
  // 判断是否是 ArrayLike Object
  // 类数组，即拥有 length 属性并且 length 属性值为 Number 类型的元素
  // 包括数组、arguments、HTML Collection 以及 NodeList 等等
  // 包括类似 {length: 10} 这样的对象
  // 包括字符串、函数等
  var isArrayLike = function(collection) {
    var length = collection != null && collection.length;
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    //第一个参数为对象或者数组
    //第二个参数为函数，能传三个参数:值，索引，原参数
    //第三个参数为上下文
    iteratee = optimizeCb(iteratee, context);//经过处理，最优化函数
    var i, length;
    if (isArrayLike(obj)) {
      //如果是类数组
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);//函数运行
      }
    } else {
      //如果是对象
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  //返回一个处理过的制定迭代函数
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);//obj处理判断是函数还是对象
    var keys = !isArrayLike(obj) && _.keys(obj),//是对象，不是类数组
        length = (keys || obj).length,//对象长度
        results = Array(length);//定义一个数组
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;//索引key，取对象的属性或者数组的索引
      results[index] = iteratee(obj[currentKey], currentKey, obj);//取运行函数的结果
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  // dir === 1 -> _.reduce
  // dir === -1 -> _.reduceRight
  //创建一个迭代函数，左右
  //把list中元素归结为一个单独的数值。Memo是reduce函数的初始值，reduce的每一步都需要由iteratee返回。
  //这个迭代传递4个参数：memo,value 和 迭代的index（或者 key）和最后一个引用的整个 list。

  //如果没有memo传递给reduce的初始调用，iteratee不会被列表中的第一个元素调用。
  //第一个元素将取代 传递给列表中下一个元素调用iteratee的memo参数。

  //var sum = _.reduce([1, 2, 3], function(memo, num){ return memo + num; }, 0);
  //=> 6
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    //memo初始值，然后下个函数再次调用累计
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        // 迭代，返回值供下次迭代调用
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      // 每次迭代返回值，供下次迭代调用
      return memo;
    }
    // _.reduce（_.reduceRight）可传入的 4 个参数
    // obj 数组或者对象
    // iteratee 迭代方法，对数组或者对象每个元素执行该方法
    // memo 初始值，如果有，则从 obj 第一个元素开始迭代
    // 如果没有，则从 obj 第二个元素开始迭代，将第一个元素作为初始值
    // context 为迭代函数中的 this 指向
    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      // 如果没有指定初始值
      // 则把第一个元素指定为初始值
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  // 与 ES5 中 Array.prototype.reduce 使用方法类似
  // _.reduce(list, iteratee, [memo], [context])
  // _.reduce 方法最多可传入 4 个参数
  // memo 为初始值，可选
  // context 为指定 iteratee 中 this 指向，可选
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  // 与 ES5 中 Array.prototype.reduceRight 使用方法类似
  //是从右侧开始组合的元素的reduce函数
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  //在list中逐项查找，返回第一个通过predicate迭代函数真值检测的元素值
  //var even = _.find([1, 2, 3, 4, 5, 6], function(num){ return num % 2 == 0; });
  //=> 2
  _.find = _.detect = function(obj, predicate, context) {
    //第一个参数为数组或
    var key;
    if (isArrayLike(obj)) {//如果是类数组
      key = _.findIndex(obj, predicate, context);//取得第一个匹配的索引
    } else {
      //对象
      key = _.findKey(obj, predicate, context);//取得属性
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  //过滤符合条件的
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);//处理判断是函数还是对象
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  //返回list中没有通过predicate真值检测的元素集合，与filter相反。
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  //如果list中的所有元素都通过predicate的真值检测就返回true。
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  //如果list中有任何一个元素通过 predicate 的真值检测就返回true。一旦找到了符合条件的元素, 就直接中断对list的遍历.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);//判断函数还是对象
    var keys = !isArrayLike(obj) && _.keys(obj),//取得属性
        length = (keys || obj).length;//长度
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;//只要有一个符合就返回真
    }
    return false;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `includes` and `include`.
  //判断如果一个数组或者对象包含给定的值
  //_.contains([1, 2, 3], 3);
  //=> true
  _.contains = _.includes = _.include = function(obj, target, fromIndex) {
  // 判断数组或者对象中（value 值）是否有指定元素
  // 如果是 object，则忽略 key 值，只需要查找 value 值即可
  // 即该 obj 中是否有指定的 value 值
  // 返回布尔值
    if (!isArrayLike(obj)) obj = _.values(obj);
    //用indexof判断
    return _.indexOf(obj, target, typeof fromIndex == 'number' && fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  //为每个元素加上一个方法
  //在list的每个元素上执行methodName方法。 任何传递给invoke的额外参数，
  //invoke都会在调用methodName方法的时候传递给它。

  //_.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
  //=> [[1, 5, 7], [1, 2, 3]]
  _.invoke = function(obj, method) {
    //slice 方法可以用来将一个类数组（Array-like）对象/集合转换成一个数组。
    //var a={length:2,0:'first',1:'second'};
    //console.log(Array.prototype.slice.call(a,1));//["second"]，调用数组的slice(1);
    var args = slice.call(arguments, 2);//取参数
    var isFunc = _.isFunction(method);//是否是函数
    return _.map(obj, function(value) {
      //value[method]拿到数组的方法，数组也是对象
      var func = isFunc ? method : value[method];
      //返回函数结果,value使用func的方法
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  //map最常使用的用例模型的简化版本，即萃取数组对象中某属性值，返回一个数组
  _.pluck = function(obj, key) {
    // 取出value值
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  //遍历list中的每一个值，返回一个数组，这个数组包含properties所列出的属性的所有的 键 - 值对。
  _.where = function(obj, attrs) {
    //使用过滤方法，不过的predicate函数为matcher找到符合条件的对象
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  //遍历整个list，返回匹配 properties参数所列出的所有 键 - 值 对的第一个值。
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  //返回list中的最大值。如果传递iteratee参数，iteratee将作为list中每个值的排序依据。
  //如果list为空，将返回-Infinity，所以你可能需要事先用isEmpty检查 list 。
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      //如果没有iteratee函数,就取每个值进行比较
      //返回类数组或者对象的值，如果是数组里面多个对象，是返回-Infinity
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        //每个值进行比较，替代小的值
        if (value > result) {
          result = value;
        }
      }
    } else {
      //如果有iteratee函数
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);//执行函数，计算属性
        // && 的优先级高于 ||,所以就是(computed > lastComputed) || (computed === -Infinity && result === -Infinity)
        //computed> lastComputed也走
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  //返回list最小的值，有max相反
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  //洗牌，返回一个随机list
  _.shuffle = function(obj) {
    //储存原值(类数组，或者返回对象的值)
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    // 乱序后返回的数组副本（参数是对象则返回乱序后的 value 数组）
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      //生成个大于0小于index的随机数
      rand = _.random(0, index);
      //交换位置
      if (rand !== index) shuffled[index] = shuffled[rand];
      //rand等不等于index都会执行下面这句
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  //从 list中产生一个随机样本。传递一个数字表示从list中返回n个随机元素。否则将返回一个单一的随机项。
  _.sample = function(obj, n, guard) {
    //如果无定义n个数，返回一个list的随机值
    if (n == null || guard) {
      //如果是类数组，取值
      if (!isArrayLike(obj)) obj = _.values(obj);
      //返回一个随机值
      return obj[_.random(obj.length - 1)];
    }
    //洗牌后返回n个
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  //返回一个排序后的list拷贝副本。如果传递iteratee参数，iteratee将作为list中每个值的排序依据。
  //迭代器也可以是字符串的属性的名称进行排序的(比如 length)。

  _.sortBy = function(obj, iteratee, context) {
    //函数？
    iteratee = cb(iteratee, context);
    //_.map()后 sort ，最后_.pluck()
    //_.pluck(),
    return _.pluck(_.map(obj, function(value, index, list) {
      //处理后的都存在这里，最有用_.pluck([],'value'),取出里面的value(value是obj数组中的一个对象或者数组)
      return {
        value: value,//obj数组中的一个对象或者数组
        index: index,//value的索引
        criteria: iteratee(value, index, list)//cb函数获得属性
      };
    }).sort(function(left, right) {
      //排序
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  //group的内部函数
  var group = function(behavior) {
    //behavior为传入的函数
    return function(obj, iteratee, context) {
      //实例传入的参数
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        //获取key->属性
        //3个参数换位置也一样，调用函数的的是参数名字
        var key = iteratee(value, index, obj);
        //传入的函数处理
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  // 根据 key 值分组
  // key 是元素经过迭代函数后的值
  // 或者元素自身的属性值
  // result 对象已经有该 key 值了
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  //给定一个list，和 一个用来返回一个在列表中的每个元素键 的iterator 函数（或属性名）， 返回一个每一项索引的对象
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  // /排序一个列表组成一个组，并且返回各组中的对象的数量的计数。类似groupBy，但是不是返回列表的值，而是返回在该组中值的数目。
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
   // 伪数组 -> 数组
  // 对象 -> 提取 value 值组成数组
  // 返回数组
  _.toArray = function(obj) {
    if (!obj) return [];
    // 如果是数组，则返回副本数组
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  //返回list的长度
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  //拆分一个数组（array）为两个数组：  第一个数组其元素都满足predicate迭代函数， 
  ///而第二个的所有元素均不能满足predicate迭代函数。
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      //predicate判断函数
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  //返回array（数组）的第一个元素。传递 n参数将返回数组中从第一个元素开始的n个元素
  //（返回数组中前 n 个元素.）
  //_.first([5, 4, 3, 2, 1]);
  //=> 5
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    // 如果传入参数 n，则返回前 n 个元素组成的数组
    // 返回前 n 个元素，即剔除后 array.length - n 个元素
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
  // 传入一个数组
  // 返回剔除最后一个元素之后的数组副本
  // 如果传入参数 n，则剔除最后 n 个元素
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  //返回array（数组）的最后一个元素。传递 n参数将返回数组中从最后一个元素开始的n个元素（愚人码头注：返回数组里的后面的n个元素）。

  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  //返回数组中除了第一个元素外的其他全部元素。传递 index 参数将返回从index开始的剩余所有元素 
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  //返回一个除去所有false值的 array副本。 在javascript中, false, null, 0, "", 
  //undefined 和 NaN 都是false值.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    //length数组的长度
    for (var i = startIndex || 0, length = input && input.length; i < length; i++) {
      //子数组
      var value = input[i];
      //判断是否是数组
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        //递归->深层展开
        //假设shallow是false，那么要全部剥离出来。首先进入到是数组的判断里面，
        //然后再进入判断，调用faltten，可以想象当下个调用flatten是个数组再进入这个判断，又再会
        //调用flatten，所以是个递归一直调用，直到最后不是数组进入到else if的里面
        //可以想象，如果去掉if(!shallow)的判断，或者shallow为true，
        //那么就只解套一次
        // 所以递归展开到最后value是个没有嵌套的数组，再执行while
        if (!shallow) value = flatten(value, shallow, strict);
        // 递归展开到最后一层（没有嵌套的数组了）
        // 或者 (shallow === true) => 只展开一层
        // value 值肯定是一个数组
        var j = 0, len = value.length;
        output.length += len;
        //然后再把提取的子数组里面的值复制给返回数组
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        // 如果是深度展开，即 shallow 参数为 false
        // 那么当最后 value 不是数组，是基本类型时
        // 肯定会走到这个 else-if 判断中
        // 而如果此时 strict 为 true，则不能跳到这个分支内部
        // 所以 shallow === false 如果和 strict === true 搭配
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  //将一个嵌套多层的数组 array（数组） (嵌套可以是任何层数)转换为只有一层的数组。 
  //如果你传递 shallow参数，数组将只减少一维的嵌套。
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  //返回一个删除所有values值后的 array副本
  _.without = function(array) {
    //传原参数的第一二个参数
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  // 返回 array去重后的副本, 使用 === 做相等测试. 
  // 如果您确定 array 已经排序,那么给 isSorted 参数传递 true值,此函数将运行的更快的算法. 
  // 如果要处理对象元素, 传递 iteratee函数来获取要对比的属性.
  // 如果第二个参数 `isSorted` 为 true
  // 则说明事先已经知道数组有序
   // 如果有第三个参数 iteratee，则对数组每个元素迭代
  // 对迭代之后的结果进行去重
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (array == null) return [];
    // 没有传入 isSorted 参数
    // 转为 _.unique(array, false, undefined, iteratee)
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = array.length; i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      // 如果是有序数组，则当前元素只需跟上一个元素对比即可
      // 用 seen 变量保存上一个元素   
      if (isSorted) {
        //如果i=0第一个不用比较
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        //经过迭代函数
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        // 如果不用经过迭代函数计算，也就不用 seen[] 变量了
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  //返回传入的 arrays（数组）并集：按顺序返回，返回数组的元素是唯一的，可以传入一个或多个 arrays（数组）。
  _.union = function() {
    //faltten传true减少一层的嵌套，然后去重
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  //_.intersection([1, 2, 3], [101, 2, 1, 10], [2, 1]);
  //=> [1, 2]
  //返回传入 arrays（数组）交集。结果中的每个值是存在于传入的每个arrays（数组）里。
  _.intersection = function(array) {
    if (array == null) return [];
    var result = [];
    var argsLength = arguments.length;
    //用第一个参数（第一个数组）的每个子数字跟其他数组的子数字比较
    for (var i = 0, length = array.length; i < length; i++) {
      //第一个子数组
      var item = array[i];
      //如果result有item，跳出，进入下一个迭代
      // 即 array 中出现了相同的元素
      // 返回的 result[] 其实是个 "集合"（是去重的）
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      // 遍历其他参数数组完毕
      // j === argsLength 说明其他参数数组中都有 item 元素
      // 则将其放入 result[] 中
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  //类似于without，但返回的值来自array参数数组，并且不存在于other 数组.
  //_.difference(array, *others) 
  //_.difference([1, 2, 3, 4, 5], [5, 2, 10]);
  //=> [1, 3, 4]
  _.difference = function(array) {
    //把参数arguments作为一个数组传第一个参数，获取只减少一维的嵌套，而且第四个参数为1，所以获取数组的第二个子数组
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      //过滤不包含的数组
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  //将 每个arrays中相应位置的值合并在一起。在合并分开保存的数据时很有用. 如果你用来处理矩阵嵌套数组时, 
   // _.zip(['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]);
  // => [["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  // /与zip功能相反的函数，给定若干arrays，返回一串联的新数组，
  //其第一元素个包含所有的输入数组的第一元素，
  //其第二包含了所有的第二元素，依此类推。通过apply用于传递数组的数组。
  // _.unzip([["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]);
  // => [['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]]
  _.unzip = function(array) {
    // 取数组的长度
    var length = array && _.max(array, 'length').length || 0;
    //新数组
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      //用map的property对应位置组成新数组
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  //将数组转换为对象。传递任何一个单独[key, value]对的列表，
  //或者一个键的列表和一个值得列表。 如果存在重复键，最后一个值将被返回
  //_.object(['moe', 'larry', 'curly'], [30, 40, 50]);
  //=> {moe: 30, larry: 40, curly: 50}
  //_.object([['moe', 30], ['larry', 40], ['curly', 50]]);
  //=> {moe: 30, larry: 40, curly: 50}
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = list && list.length; i < length; i++) {
      //如果有values，就是两个参数为属性名跟值的数组
      if (values) {
        result[list[i]] = values[i];
      } else {
        //如果没有valuse，就是一个数组里的多个子数组组合
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  //返回value在该 array 中的索引值，如果value不存在 array中就返回-1。
  //使用原生的indexOf 函数，除非它失效。如果您正在使用一个大数组，
  //你知道数组已经排序，传递true给isSorted将更快的用二进制搜索..,
  //或者，传递一个数字作为第三个参数，为了在给定的索引的数组中寻找第一个匹配值。
  //_.indexOf([1, 2, 3], 2);
  //=> 1
  _.indexOf = function(array, item, isSorted) {
    //length数组的长度
    var i = 0, length = array && array.length;
    //知道数组已经排序，使用更快的搜索
    // 如果数组有序，则第三个参数可以传入 true
    // 这样算法效率会更高（二分查找）
    // [isSorted] 参数表示数组是否有序  
    if (typeof isSorted == 'number') {
      //已知指定位置，跟数组的操作方法一样，如果是负，就用length相加
      i = isSorted < 0 ? Math.max(0, length + isSorted) : isSorted;
    } else if (isSorted && length) {
      //用 _.sortIndex 找到有序数组中 item 正好插入的位置
      i = _.sortedIndex(array, item);
      //找到位置，返回值
      return array[i] === item ? i : -1;
    }
    // 特判，如果要查找的元素是 NaN 类型
    // 如果 item !== item
    // 那么 item => NaN
    if (item !== item) {
      return _.findIndex(slice.call(array, i), _.isNaN);
    }
    //一般传两个参数的查询方法
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };
  //返回value在该 array 中的从最后开始的索引值，如果value不存在 array中就返回-1。
  //如果支持原生的lastIndexOf，将使用原生的lastIndexOf函数。
  //传递fromIndex将从你给定的索性值开始搜索。
  //_.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
  // => 4
  _.lastIndexOf = function(array, item, from) {
    var idx = array ? array.length : 0;
    // 已知位置：from
    if (typeof from == 'number') {
      idx = from < 0 ? idx + from + 1 : Math.min(idx, from + 1);
    }
    // 特判，如果要查找的元素是 NaN 类型
    // 如果 item !== item
    // 那么 item => NaN
    if (item !== item) {
      return _.findLastIndex(slice.call(array, 0, idx), _.isNaN);
    }
    //最后查找
    while (--idx >= 0) if (array[idx] === item) return idx;
    return -1;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createIndexFinder(dir) {
    //dir 位置
    //类似于_.indexOf，当predicate通过真检查时，返回第一个索引值；否则返回-1
    //var arr = [1, 3, 5, 2, 4, 6];
    //var isEven = function(num) {
    //  return !(num & 1);
    //};
    //var idx = _.findIndex(arr, isEven);
    // => 3
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      //数组长度
      var length = array != null && array.length;
      //取位置最初或最后
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        //如果predicate参数不是函数，返回_.indentity函数返回值就返回0
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  // 类似于_.indexOf，当predicate通过真检查时，返回第一个索引值；否则返回-1。
  _.findIndex = createIndexFinder(1);

  _.findLastIndex = createIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  //_.sortedIndex([10, 20, 30, 40, 50], 35);
  //=> 3

  //var stooges = [{name: 'moe', age: 40}, {name: 'curly', age: 60}];
  //_.sortedIndex(stooges, {name: 'larry', age: 50}, 'age');
  //=> 1
  // 二分查找
  // 将一个元素插入已排序的数组
  // 返回该插入的位置下标
  _.sortedIndex = function(array, obj, iteratee, context) {
    //初始化值
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    //最大与最小的位置
    var low = 0, high = array.length;
    while (low < high) {
      //中间位置
      var mid = Math.floor((low + high) / 2);
      //从中间开始查找，向上或者向下
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  //一个用来创建整数灵活编号的列表的函数，便于each 和 map循环。
  //如果省略start则默认为 0；step 默认为 1.
  //返回一个从start 到stop的整数的列表，
  //用step来增加 （或减少）独占。
  //值得注意的是，如果stop值在start前面（也就是stop值小于start值），
  //那么值域会被认为是零长度，而不是负增长。
  //-如果你要一个负数的值域 ，请使用负数step.
  //_.range(10);
  //=> [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  //_.range(1, 11);
  //=> [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  //_.range(0, 30, 5);
  //=> [0, 5, 10, 15, 20, 25]
  //_.range(0, -10, -1);
  //=> [0, -1, -2, -3, -4, -5, -6, -7, -8, -9]
  //_.range(0);
  //=> []
  _.range = function(start, stop, step) {
    //如果参数小于1，结束的值开始的参数，开始为0
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    //加或者减的幅度
    step = step || 1;
    //差值->多少个值
    var length = Math.max(Math.ceil((stop - start) / step), 0);
    //生成个数组
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      //添加数组的值
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    //sourceFunc参数函数；boundFunc新函数；callingContext-this；args参数
    //如果是callingcontext不是boundFunc的实例
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    //不然用object.create使用指定的原型对象及其属性去创建一个新的对象
    var self = baseCreate(sourceFunc.prototype);
    //然后把原参数函数定向 绑定到self
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
   //绑定函数 function 到对象 object 上, 也就是无论何时调用函数,
  // 函数里的 this 都指向这个 object.任意可选参数 arguments 可以传递给函数 function , 
  //可以填充函数所需要的参数,这也被称为 partial application。
  //对于没有结合上下文的partial application绑定，请使用partial。 
  //var func = function(greeting){ return greeting + ': ' + this.name };
  //func = _.bind(func, {name: 'moe'}, 'hi');
  //func();
  //=> 'hi: moe'
  _.bind = function(func, context) {
     // 如果浏览器支持 ES5 bind 方法，并且 func 上的 bind 方法没有被重写
    // 则优先使用原生的 bind 方法
    //slice.call(arguments,1)取得第一个参数;下面的代码就是绑定函数
    //nativeBind.apply 与
    //var unboundSlice = Array.prototype.slice;
    //var slice = Function.prototype.call.bind(unboundSlice);
    //function list() {
    //return slice(arguments);
    //}
    //var list1 = list(1, 2, 3); // [1, 2, 3]
    //一样，前面的nativeBind是要绑定的，然后用apply
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
     // 如果传入的参数 func 不是方法，则抛出错误
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
     // polyfill
    // 经典闭包，函数返回函数
    // args 获取优先使用的参数
    //取第二个参数
    var args = slice.call(arguments, 2);
    // args.concat(slice.call(arguments))
      // 最终函数的实际调用参数由两部分组成
      // 一部分是传入 _.bind 的参数（会被优先调用）
      // 另一部分是传入 bound（_.bind 所返回方法）的参数
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  //局部应用一个函数填充在任意个数的 arguments，不改变其动态this值。和bind方法很相近。
  //你可以传递_ 给arguments列表来指定一个不预先填充，但在调用时提供的参数。
  // /var subtract = function(a, b) { return b - a; };
  //sub5 = _.partial(subtract, 5);
  //sub5(20);
  //=> 15
// Using a placeholder
  //subFrom20 = _.partial(subtract, _, 20);
  //subFrom20(5);
  //=> 15
  _.partial = function(func) {
    //取除了第一个参数->
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      //length参数长度
      var position = 0, length = boundArgs.length;
      //参数的新数组
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        //重组要操作的值的对应位置，实例前的参数位置，与执行函数时的位置
        //如果是等与 _ ,就等于 subFrom20(5)的5参数,下面的arguments是bound函数的---->闭包真叼
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      //bound还有剩余的arguments也添加上去
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  // 指定一系列方法（methodNames）中的 this 指向（object）
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    // 如果只传入了一个参数（obj），没有传入 methodNames，则报错
    if (length <= 1) throw new Error('bindAll must be passed function names');
    // 遍历 methodNames
    for (i = 1; i < length; i++) {
      key = arguments[i];
      // 逐个绑定
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  //Memoizes方法可以缓存某函数的计算结果。对于耗时较长的计算是很有帮助的。
  //如果传递了 hashFunction 参数，就用 hashFunction 的返回值作为key存储函数的计算结果。
  //hashFunction 默认使用function的第一个参数作为key。memoized值的缓存可作为返回函数的cache属性
  // /var fibonacci = _.memoize(function(n) {
  // return n < 2 ? n: fibonacci(n - 1) + fibonacci(n - 2);
  //})
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      // 缓存的保存地址
      var cache = memoize.cache;
       //如果传入了 hasher，则用 hasher 函数来计算 key，否则用 参数 key（即 memoize 方法传入的第一个参数）当 key
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      //保存计算过的不存在的键值
       //如果这个 key 还没被 hash 过（还没求过值）
       // _memoize()里面的参数函数在这里执行,结果赋值给cache
       // 执行行数一直递归fibonacci(n - 1) + fibonacci(n - 2)相加
       // 因为是下一个函数是(n-1)+(n-2);有用到上一个(n-1)的值，所以这个方法的作用就是保存上一次的(n-1)值，到下次执行
       //函数可以用
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      // 返回结果
      return cache[address];
    };
    memoize.cache = {};// cache 对象被当做 key-value 键值对缓存中间运算结果
    return memoize;// 返回一个函数（经典闭包）
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  //类似setTimeout，等待wait毫秒后调用function。如果传递可选的参数arguments，
  //当函数function执行时， arguments 会作为参数传入。
  //var log = _.bind(console.log, console);
  //_.delay(log, 1000, 'logged later');
  //=> 'logged later' // Appears after one second.
  _.delay = function(func, wait) {
    // 取最后一个参数(字符串..)
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  //延迟调用function直到当前调用栈清空为止，类似使用延时为0的setTimeout方法。
  //对于执行开销大的计算和无阻塞UI线程的HTML渲染时候非常有用。 
  //如果传递arguments参数，当函数function执行时， arguments 会作为参数传入。
  //_.defer(function(){ alert('deferred'); });
// Returns from the function before the alert runs.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  //创建并返回一个像节流阀一样的函数，当重复调用函数的时候，最多每隔 wait毫秒调用一次该函数。
  //对于想控制一些触发频率较高的事件有帮助。（愚人码头注：详见：javascript函数的throttle和debounce）
  //默认情况下，throttle将在你调用的第一时间尽快执行这个function，
  //并且，如果你在wait周期内调用任意次数的函数，都将尽快的被覆盖。
  //如果你想禁用第一次首先执行的话，传递{leading: false}，还有如果你想禁用最后一次执行的话，传递{trailing: false}。
  //var throttled = _.throttle(updatePosition, 100);
  //$(window).scroll(throttled);


  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};//如果没有传入 options 参数// 则将 options 参数置为空对象
    //最后一次执行
    //如果 options.leading === false，则每次触发回调后将 previous 置为 0，否则置为当前时间戳
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    
    return function() {
      // 取现在时间
      var now = _.now();
      // 如果是第一次，而且第一次不马上执行，要延时wait时间
      //为什么previous,timeout能取上个执行函数的值，这是因为previous为父函数定义的，return function() 这个返回函数
      // 是个闭包，能访问改变previous的值，那么下个函数也就能访问改变了的previous的值
      //第一次执行回调（此时 previous 为 0，之后 previous 值为上一次时间戳）
      //并且如果程序设定第一个回调不是立即执行的（options.leading === false），
      //则将 previous 值（表示上次执行的时间戳）设为 now 的时间戳（第一次触发时），表示刚执行过，这次就不用执行了
      if (!previous && options.leading === false) previous = now;
      // 如果不马上执行，(now - previous)=0就是要等待wait时间,如果马上执行remaining为负数
      // 距离下次触发 func 还需要等待的时间
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;// 解除引用，防止内存泄露
        }
         // 重置前一次触发的时间戳
        previous = now;
        // 触发方法，result 为该方法返回值
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        //如果已经存在一个定时器，则不会进入该 if 分支
        // 如果 {trailing: false}，即最后一次不需要触发了，也不会进入这个分支
        timeout = setTimeout(later, remaining);// 间隔 remaining milliseconds 后触发 later 方法
      }
      return result;// 回调返回值
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  // 函数去抖（连续事件触发结束后只触发一次）
  // sample 1: _.debounce(function(){}, 1000)
  // 连续事件结束后的 1000ms 后触发
  // sample 1: _.debounce(function(){}, 1000, true)
  // 连续事件触发后立即触发（此时会忽略第二个参数）
  //function ajax_lookup( event ) {
  // 对输入的内容$(this).val()执行 Ajax 查询
  //};
  // 字符输入的频率比你预想的要快，Ajax 请求来不及回复。
  //$('input:text').keyup( ajax_lookup );
  // 当用户停顿250毫秒以后才开始查找
  //$('input:text').keyup( _.debounce( ajax_lookup. 250 ) );
  //策略的电梯。如果电梯里有人进来，等待15秒。
  //如果又人进来，15秒等待重新计时，直到15秒超时，开始运送
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;
    var later = function() {
      var last = _.now() - timestamp;
      // 如果0 <= last < wait还是wait时间内，所以还是执行延时函数
      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        // 如果时间到了，设置定时器都null，以便如果有继续执行函数，就可以再次延时函数
        timeout = null;
        //如果不是立即执行，防止一开始执行连续函数后已经出发一次结果
        if (!immediate) {
          result = func.apply(context, args);
          // timeout肯定是null，释放内存
          if (!timeout) context = args = null;
        }
      }
    };
    // 返回闭包函数
    return function() {
      context = this;
      // "返回闭包函数"的传入参数
      args = arguments;
      //时间戳
      timestamp = _.now();
      //如果immediate是true，立即触发事件
      var callNow = immediate && !timeout;
      // 如果第一次执行函数或者没有了timeout，又继续执行了函数，就再次调用延时
      if (!timeout) timeout = setTimeout(later, wait);
      // 如果callNow是ture，就是第一次执行函数，timeout为null，此时会忽略wait
      if (callNow) {
        //如果是callNow立即执行回调函数
        result = func.apply(context, args);
        // 释放内存
        context = args = null;
      }
      // 返回执行函数的结果
      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  //将第一个函数 function 封装到函数 wrapper 里面, 
  //并把函数 function 作为第一个参数传给 wrapper. 
  //这样可以让 wrapper 在 function 运行之前和之后 执行代码,
  // 调整参数然后附有条件地执行.
  //var hello = function(name) { return "hello: " + name; };
  //hello = _.wrap(hello, function(func) {
  //return "before, " + func("moe") + ", after";
  //});
  //hello();
  //=> 'before, hello: moe, afte
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  //返回相反的断言
  _.negate = function(predicate) {
    return function() {//返回的运行传参的函数，取运行函数的相反boolean
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  //返回函数集 functions 组合后的复合函数, 
  //也就是一个函数执行完之后把返回的结果再作为参数赋给下一个函数来执行. 
  //以此类推. 在数学里, 把函数 f(), g(), 和 h() 组合起来可以得到复合函数 f(g(h()))。
  //var greet    = function(name){ return "hi: " + name; };
  //var exclaim  = function(statement){ return statement.toUpperCase() + "!"; };
  //var welcome = _.compose(greet, exclaim);
  //welcome('moe');
  //=> 'hi: MOE!'
  _.compose = function() {
    // 参数
    var args = arguments;
    // 除去一的参数后的参数长度
    var start = args.length - 1;
    // 回调函数
    return function() {
      var i = start;
      // 上个函数的执行结果，传个下个函数
      var result = args[start].apply(this, arguments);
      // 循环执行参数函数
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };
  //创建一个函数, 只有在运行了 count 次之后才有效果.
  // 在处理同组异步请求返回结果时, 如果你要确保同组里所有异步请求完成之后才 
  //执行这个函数, 这将非常有用。

  //var renderNotes = _.after(notes.length, render);
  //_.each(notes, function(note) {
    //note.asyncSave({success: renderNotes});
  //});
// renderNotes is run once, after all notes have saved.
  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      // 闭包，每次执行函数times都会减一，值到times小于，就是第times后
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    // 跟after
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  // 函数至多只能被调用一次
  // 适用于这样的场景，某些函数只能被初始化一次，不得不设置一个变量 flag
  // 初始化后设置 flag 为 true，之后不断 check flag
  // ====== //
  // 其实是调用了 _.before 方法，
  //并且将 times 参数设置为了默认值 2（也就是 func 至多能被调用 2 - 1 = 1 次）
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  // IE < 9 下 不能用 for key in ... 来枚举对象的某些 key
  // 比如重写了对象的 `toString` 方法，这个 key 值就不能在 IE < 9 下用 for in 枚举到
  // IE < 9，{toString: null}.propertyIsEnumerable('toString') 返回 false
  // IE < 9，重写的 `toString` 属性被认为不可枚举
  // 据此可以判断是否在 IE < 9 浏览器环境中
  // 下面的要这样看!({toString: null}.propertyIsEnumerable('toString'))
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');

  // IE < 9 下不能用 for in 来枚举的 key 值集合
  // 其实还有个 `constructor` 属性
  // 个人觉得可能是 `constructor` 和其他属性不属于一类
  // nonEnumerableProps[] 中都是方法
  // 而 constructor 表示的是对象的构造函数
  // 所以区分开来了
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  // obj 为需要遍历键值对的对象
  // keys 为键数组
  // 利用 JavaScript 按值传递的特点
  // 传入数组作为参数，能直接改变数组的值
  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;

    // 获取对象的原型
    // 如果 obj 的 constructor 被重写
    // 则 proto 变量为 Object.prototype
    // 如果没有被重写
    // 则为 obj.constructor.prototype
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    // `constructor` 属性需要特殊处理 (是否有必要？)
    // see https://github.com/hanzichi/underscore-analysis/issues/3
    // 如果 obj 有 `constructor` 这个 key
    // 并且该 key 没有在 keys 数组中
    // 存入 keys 数组
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    // 遍历 nonEnumerableProps 数组中的 keys
    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      // prop in obj 应该肯定返回 true 吧？是否有判断必要？
      // obj[prop] !== proto[prop] 判断该 key 是否来自于原型链
      // 即是否重写了原型链上的属性
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  ///返回对象的键值
  //检索object拥有的所有可枚举属性的名称。
  //返回的属性是作为自身的属性，不可继承
  //obj.hasOwnproperty(prop) 为true
  _.keys = function(obj) {
    //如果不是对象，返回[]
    if (!_.isObject(obj)) return [];
    // 如果支持es5方法 Oeject.keys()
    if (nativeKeys) return nativeKeys(obj);
    // 定义一个kesy空数组
    var keys = [];
    // 遍历对象, 如果对象存在键值则添加到数组
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    // 如果ie<9，toString等方法不能枚举,用collectNonEnumProps方法添加
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  // /检索object拥有的和继承的所有属性的名称。
  //function Stooge(name) {
    //this.name = name;
  //}
  //Stooge.prototype.silly = true;
  //_.allKeys(new Stooge("Moe"));
  //=> ["name", "silly"]
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  // 返回对象的属性值
  _.values = function(obj) {
    //  取出对象的键值
    var keys = _.keys(obj);
    // 键值的长度
    var length = keys.length;
    // 定义待填充的已知长度的空数组
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      // 循环填充属性值
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  //它类似于map，但是这用于对象。转换每个属性的值。
  _.mapObject = function(obj, iteratee, context) {
    // 初始化参数函数
    iteratee = cb(iteratee, context);
    //获取对象的键值，长度，定义返回的结果
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        // 取得缩影键值
        currentKey = keys[index];
        // 执行函数，对对象的值进行操作,赋值给results新的值
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  // 把一个对象转变为一个[key, value]形式的数组
  _.pairs = function(obj) {
    // 取得键值
    var keys = _.keys(obj);
    var length = keys.length;
    // 返回的结果数组
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  //返回一个object副本，使其键（keys）和值（values）对换。对于这个操作，
  //必须确保object里所有的值都是唯一的且可以序列号成字符串.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  //返回一个对象里所有的方法名, 
  //而且是已经排序的 — 也就是说, 对象里每个方法(属性值是一个函数)的名称.
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      // 如果是函数
      if (_.isFunction(obj[key])) names.push(key);
    }
    //排序
    return names.sort();
  };

  // An internal function for creating assigner functions.
  //extend,extendOwn,defaults
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      //回调函数，obj为传入的第一个对象参数_.extend({a:1})
      var length = arguments.length;
      //length 参数数量
      if (length < 2 || obj == null) return obj;
      //只有一个参数，或者没有参数返回obj
      for (var index = 1; index < length; index++) {
        //遍历
        var source = arguments[index],//参数
            keys = keysFunc(source),//取prototy 的 name
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          //两种情况extend,extendOwn与defaults
          //第一种没有传入undefinedOnly即!undefinedOnly为true所以执行obj[key] = source[key]
          //其实eundefinedOnly主要是与第一种区分，作用让那个它只有当原obj没有某个属性是才走下一步
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // Extend a given object with all the properties in passed-in object(s).
  //复制source对象中的所有属性覆盖到destination对象上，并且返回 destination 对象. 
  //复制是按顺序的, 所以后面的对象属性会把前面的对象属性覆盖掉(如果有重复).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  //类似于 extend, 但只复制自己的属性覆盖到目标对象。
  _.extendOwn = _.assign = createAssigner(_.keys);


  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);


  // Returns the first key on an object that passes a predicate test
  // 跟数组方法的 _.findIndex 类似
  // 找到对象的键值对中第一个满足条件的键值对
  // 并返回该键值对 key 值
  _.findKey = function(obj, predicate, context) {
    // 初始化函数
    predicate = cb(predicate, context);
    // 取出键值组
    var keys = _.keys(obj), key;
    // 遍历
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      // 如果满足条件
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  //返回一个object副本，只过滤出keys(有效的键组成的数组)参数指定的属性值。
  //或者接受一个判断函数，指定挑选哪个key。
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    // 如果要过滤的对象有空
    if (obj == null) return result;
    // 如果过滤的操作是个函数
    if (_.isFunction(oiteratee)) {
      // 取出函数的键值
      keys = _.allKeys(obj);
      // 初始化函数
      iteratee = optimizeCb(oiteratee, context);
    } else {
      // 过滤的操作是多个键值
      keys = flatten(arguments, false, false, 1);
      // 自定义一个返回判断是否有键值的函数
      iteratee = function(value, key, obj) { return key in obj; };
      // 把要过滤的对象对象化
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      // 满足条件
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  //  返回一个object副本，只过滤出除去keys(有效的键组成的数组)参数指定的属性值。 
  //或者接受一个判断函数，指定忽略哪个key
  // /_.omit({name: 'moe', age: 50, userid: 'moe1'}, 'userid');
  //=> {name: 'moe', age: 50}
  //_.omit({name: 'moe', age: 50, userid: 'moe1'}, function(value, key, object) {
  //return _.isNumber(value);
  //});
  //=> {name: 'moe', userid: 'moe1'}
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      // _.negate 方法对 iteratee 的结果取反
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    // iteratee经过操作取相反的值，然后调用pick方法
    return _.pick(obj, iteratee, context);
  };

  

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  // 给定 prototype
  // 以及一些 own properties
  // 构造一个新的对象并返回
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  //创建 一个浅复制（浅拷贝）的克隆object。任何嵌套的对象或数组都通过引用拷贝，不会复制。
  _.clone = function(obj) {
    // 如果不是对象返回
    if (!_.isObject(obj)) return obj;
    // 如果是数组，则用 obj.slice() 返回数组副本
    // 如果是对象，则提取所有 obj 的键值对覆盖空对象，返回
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  // _.chain([1,2,3,200])
  // .filter(function(num) { return num % 2 == 0; })
  // .tap(alert)
  // .map(function(num) { return num * num })
  // .value();
  // => // [2, 200] (alerted)
  // => [4, 40000]
  // 主要是用在链式调用中
  // 对中间值立即进行处理
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  //告诉你attrs中的键和值是否包含在object中。
  _.isMatch = function(object, attrs) {
    //取属性与长度
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    // object是数组?的第一个对象
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      //遍历-是否在检查对象里面
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    // a === b 时
    // 需要注意 `0 === -0` 这个 special case
    // 0 和 -0 被认为不相同（unequal）
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    // 如果 a 和 b 有一个为 null（或者 undefined）
    // 判断 a === b
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    // 如果 a 和 b 是 underscore OOP 的对象
    // 那么比较 _wrapped 属性值（Unwrap）
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    // 用 Object.prototype.toString.call 方法获取 a 变量类型
    var className = toString.call(a);
    // 如果 a 和 b 类型不相同，则返回 false
    // 类型都不同了还比较个蛋！
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
         // RegExp 和 String 可以看做一类
      // 如果 obj 为 RegExp 或者 String 类型
      // 那么 '' + obj 会将 obj 强制转为 String
      // 根据 '' + a === '' + b 即可判断 a 和 b 是否相等
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        // 如果 +a !== +a
        // 那么 a 就是 NaN
        // 判断 b 是否也是 NaN 即可
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
         // 排除了 NaN 干扰
        // 还要考虑 0 的干扰
        // 用 +a 将 Number() 形式转为基本类型
        // 即 +Number(1) ==> 1
        // 0 需要特判
        // 如果 a 为 0，判断 1 / +a === 1 / b
        // 否则判断 +a === +b
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
          // 如果 a 为 Number 类型
      // 要注意 NaN 这个 special number
      // NaN 和 NaN 被认为 equal
      // ================
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
         // Date 和 Boolean 可以看做一类
      // 如果 obj 为 Date 或者 Boolean
      // 那么 +obj 会将 obj 转为 Number 类型
      // 然后比较即可
      // +new Date() 是当前时间距离 1970 年 1 月 1 日 0 点的毫秒数
      // +true => 1
      // +new Boolean(false) => 0
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      // 如果不是数组
      // 用typeof进行判断是否是对象
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      // 通过构造函数来判断 a 和 b 是否相同
      // 但是，如果 a 和 b 的构造函数不同
      // 也并不一定 a 和 b 就是 unequal
      // 比如 a 和 b 在不同的 iframes 中！
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    
    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
     // 第一次调用 eq() 函数，没有传入 aStack 和 bStack 参数
    // 之后递归调用都会传入这两个参数
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      // aStack 作用在这里做个判断，比较他们的长度
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
     // 将嵌套的对象和数组展开
    // 如果 a 是数组
    // 因为嵌套，所以需要展开深度比较
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
       // 如果 a 和 b length 属性大小不同
      // 那么显然 a 和 b 不同
      // return false 不用继续比较了
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
        // a 和 b 对象的键数量不同
      // 那还比较毛？
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
     // 与 aStack.push(a) 对应
    // 此时 aStack 栈顶元素正是 a
    // 而代码走到此步
    // a 和 b isEqual 确认
    // 所以 a，b 两个元素可以出栈
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  //执行两个对象之间的优化深度比较，确定他们是否应被视为相等。

  //var stooge = {name: 'moe', luckyNumbers: [13, 27, 34]};
  //var clone  = {name: 'moe', luckyNumbers: [13, 27, 34]};
  //stooge == clone;
  //=> false
  //_.isEqual(stooge, clone);
  //=> true
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  // /如果object 不包含任何值(没有可枚举的属性)，返回true。 
  //对于字符串和类数组（array-like）对象，如果length属性为0，那么_.isEmpty检查返回true。
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  // 如果object是一个DOM元素，返回true。
  _.isElement = function(obj) {
    // 确保 obj 不是 null, undefined 等假值
    // 并且 obj.nodeType === 1
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  // 是否是数组
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  // 是否是对象
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    // 这里不是用_.['is'+name]; _ 是对象,所以用我们平时用的数组框取，赋值一样，var a = {c:1};a[c] => 1
    // 这里是赋值
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  // _.isArguments 方法在 IE < 9 下的兼容
  // IE < 9 下对 arguments 调用 Object.prototype.toString.call 方法
  // 结果是 => [object Object]
  // 而并非我们期望的 [object Arguments]。
  // so 用是否含有 callee 属性来做兼容
  if (!_.isArguments(arguments)) {
    //如果object是一个参数对象，返回true。
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  // _.isFunction 在 old v8, IE 11 和 Safari 8 下的兼容
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
   // 判断是否是 NaN
  // NaN 是唯一的一个 `自己不等于自己` 的 number 类型
  // 这样写有 BUG
  // _.isNaN(new Number(0)) => true
  // 详见 https://github.com/hanzichi/underscore-analysis/issues/13
  // 最新版本（edge 版）已经修复该 BUG
  // Is the given value `NaN`?
  //_.isNaN = function(obj) {
    //return _.isNumber(obj) && isNaN(obj);
  //};
  //obj 得是个 Number 类型，并且能通过 isNaN 函数的判断，才能返回 true。
  //其实能通过这个函数的，只有两个值，NaN 和 new Number(NaN)（当然还有 Number.NaN，
  //前面说了，NaN 和 Number.NaN 是一样的东西，下同）。
  //而能通过 Number.isNaN 函数的只有 NaN。（Number.isNaN(new Number(NaN) 会返回 false）
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  // 判断对象中是否有指定 key
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  // 如果全局环境中已经使用了 `_` 变量
  // 可以用该方法返回其他变量
  // 继续使用 underscore 中的方法
  // var underscore = _.noConflict();
  // underscore.each(..);
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  // 返回传入的参数，看起来好像没什么卵用
  // 其实 _.identity 在 undescore 内大量作为迭代函数出现
  // 能简化很多迭代函数的书写
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  //创建一个函数，这个函数 返回相同的值 用来作为_.constant的参数。
  _.constant = function(value) {
    return function() {
      return value;
    };
  };
  // /返回undefined，不论传递给它的是什么参数。 可以用作默认可选的回调参数。
  _.noop = function(){};
  //返回键的值
  //返回一个函数，这个函数返回任何传入的对象的key属性。



  // 一个数组，元素都是对象
  // 根据指定的 key 值
  // 返回一个数组，元素都是指定 key 值的 value 值
  //var stooge = {name: 'moe'};
  //'moe' === _.property('name')(stooge);
  //=> true
  _.property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Generates a function for a given object that returns a given property.
  //和_.property相反。需要一个对象，并返回一个函数,这个函数将返回一个提供的属性的值。
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of 
  // `key:value` pairs.
  //判断对象，类对象是否含有给的属性与值
  _.matcher = _.matches = function(attrs) {
    //使成为一个对象
    attrs = _.extendOwn({}, attrs);
    //执行_.matcher()后返回函数
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  // 调用给定的迭代函数n次,每一次调用iteratee传递index参数。生成一个返回值的数组。 
  //注意: 本例使用 链式语法。
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    //返回一个大于1的随机数，但没有对小于1的进行处理
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  // 返回当前时间的 "时间戳"（单位 ms）
  // 其实并不是时间戳，时间戳还要除以 1000（单位 s）
  // +new Date 类似
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  // _.invert 方法将一个对象的键值对对调
  // unescapeMap 用于解码
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
     // 正则替换
    var source = '(?:' + _.keys(map).join('|') + ')';
    // 正则 pattern
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
     // 全局替换
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  // 编码，防止被 XSS 攻击等一些安全隐患
  // /_.escape('Curly, Larry & Moe');
  //=> "Curly, Larry &amp; Moe"
  _.escape = createEscaper(escapeMap);
  // 解码
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  //如果指定的property 的值是一个函数，那么将在object上下文内调用它;否则，返回它。
  //如果提供默认值，并且属性不存在，那么默认值将被返回。
  //如果设置defaultValue是一个函数，它的结果将被返回。
  //var object = {cheese: 'crumpets', stuff: function(){ return 'nonsense'; }};
  //_.result(object, 'cheese');
  //=> "crumpets"
  //_.result(object, 'stuff');
  //=> "nonsense"
  //_.result(object, 'meat', 'ham');
  //=> "ham"
  _.result = function(object, property, fallback) {
    // 取出键的值
    var value = object == null ? void 0 : object[property];
    //  如果找不到，有第三个参数的话，用它的值
    if (value === void 0) {
      value = fallback;
    }
    // 如果值是函数就执行函数,否则返回值
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  // 生成客户端临时的 DOM ids
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  // ERB => Embedded Ruby
  // Underscore 默认采用 ERB-style 风格模板，也可以根据自己习惯自定义模板
  // 1. <%  %> - to execute some code
  // 2. <%= %> - to print some value in template
  // 3. <%- %> - to print some values HTML escaped
  _.templateSettings = {
    // 三种渲染模板
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',  // 回车符
    '\n':     'n',  // 换行符
    // http://stackoverflow.com/questions/16686687/json-stringify-and-u2028-u2029-check
    '\u2028': 'u2028', // Line separator
    '\u2029': 'u2029'  // Paragraph separator
  };

  // RegExp pattern
  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    /**
      '      => \\'
      \\     => \\\\
      \r     => \\r
      \n     => \\n
      \u2028 => \\u2028
      \u2029 => \\u2029
    **/
    return '\\' + escapes[match];
  };

  // 将 JavaScript 模板编译为可以用于页面呈现的函数
  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  // oldSettings 参数为了兼容 underscore 旧版本
  // setting 参数可以用来自定义字符串模板（但是 key 要和 _.templateSettings 中的相同，才能 overridden）
  // 1. <%  %> - to execute some code
  // 2. <%= %> - to print some value in template
  // 3. <%- %> - to print some values HTML escaped
  // Compiles JavaScript templates into functions
  // _.template(templateString, [settings])
  _.template = function(text, settings, oldSettings) {
    // 兼容旧版本
    if (!settings && oldSettings)
      settings = oldSettings;

    // 相同的 key，优先选择 settings 对象中的
    // 其次选择 _.templateSettings 对象中的
    // 生成最终用来做模板渲染的字符串
    // 自定义模板优先于默认模板 _.templateSettings
    // 如果定义了相同的 key，则前者会覆盖后者
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    // 正则表达式 pattern，用于正则匹配 text 字符串中的模板字符串
    // /<%-([\s\S]+?)%>|<%=([\s\S]+?)%>|<%([\s\S]+?)%>|$/g
    // 注意最后还有个 |$
    var matcher = RegExp([
      // 注意下 pattern 的 source 属性
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    // 编译模板字符串，将原始的模板字符串替换成函数字符串
    // 用拼接成的函数字符串生成函数（new Function(...)）
    var index = 0;

    // source 变量拼接的字符串用来生成函数
    // 用于当做 new Function 生成函数时的函数字符串变量
    // 记录编译成的函数字符串，可通过 _.template(tpl).source 获取（_.template(tpl) 返回方法）
    var source = "__p+='";

    // replace 函数不需要为返回值赋值，主要是为了在函数内对 source 变量赋值
    // 将 text 变量中的模板提取出来
    // match 为匹配的整个串
    // escape/interpolate/evaluate 为匹配的子表达式（如果没有匹配成功则为 undefined）
    // offset 为字符匹配（match）的起始位置（偏移量）
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      // \n => \\n
      source += text.slice(index, offset).replace(escaper, escapeChar);

      // 改变 index 值，为了下次的 slice
      index = offset + match.length;

      if (escape) {
        // 需要对变量进行编码（=> HTML 实体编码）
        // 避免 XSS 攻击
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        // 单纯的插入变量
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        // 可以直接执行的 JavaScript 语句
        // 注意 "__p+="，__p 为渲染返回的字符串
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offset.
      // return 的作用是？
      // 将匹配到的内容原样返回（Adobe VMs 需要返回 match 来使得 offset 值正常）
      return match;
    });

    source += "';\n";

    // By default, `template` places the values from your data in the local scope via the `with` statement.
    // However, you can specify a single variable name with the variable setting.
    // This can significantly improve the speed at which a template is able to render.
    // If a variable is not specified, place data values in local scope.
    // 指定 scope
    // 如果设置了 settings.variable，能显著提升模板的渲染速度
    // 否则，默认用 with 语句指定作用域
    if (!settings.variable)
      source = 'with(obj||{}){\n' + source + '}\n';

    // 增加 print 功能
    // __p 为返回的字符串
    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      // render 方法，前两个参数为 render 方法的参数
      // obj 为传入的 JSON 对象，传入 _ 参数使得函数内部能用 Underscore 的函数
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      // 抛出错误
      e.source = source;
      throw e;
    }

    // 返回的函数
    // data 一般是 JSON 数据，用来渲染模板
    var template = function(data) {
      // render 为模板渲染函数
      // 传入参数 _ ，使得模板里 <%  %> 里的代码能用 underscore 的方法
      //（<%  %> - to execute some code）
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    // template.source for debug?
    // obj 与 with(obj||{}) 中的 obj 对应
    var argument = settings.variable || 'obj';

    // 可通过 _.template(tpl).source 获取
    // 可以用来预编译，在服务端预编译好，直接在客户端生成代码，客户端直接调用方法
    // 这样如果出错就能打印出错行
    // Precompiling your templates can be a big help when debugging errors you can't reproduce.
    // This is because precompiled templates can provide line numbers and a stack trace,
    // something that is not possible when compiling templates on the client.
    // The source property is available on the compiled template function for easy precompilation.
    // see @http://stackoverflow.com/questions/18755292/underscore-js-precompiled-templates-using
    // see @http://stackoverflow.com/questions/13536262/what-is-javascript-template-precompiling
    // see @http://stackoverflow.com/questions/40126223/can-anyone-explain-underscores-precompilation-in-template
    // JST is a server-side thing, not client-side.
    // This mean that you compile Unserscore template on server side by some server-side script and save the result in a file.
    // Then use this file as compiled Unserscore template.
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  //返回一个封装的对象. 在封装的对象上调用方法会返回封装的对象本身, 直道 value 方法调用为止.

  //var stooges = [{name: 'curly', age: 25}, {name: 'moe', age: 21}, {name: 'larry', age: 23}];
  //var youngest = _.chain(stooges)
  //.sortBy(function(stooge){ return stooge.age; })
  //.map(function(stooge){ return stooge.name + ' is ' + stooge.age; })
  //.first()
  //.value();
  //=> "moe is 21"
  _.chain = function(obj) {
    // 非 OOP 调用 chain
  // _.chain([1, 2, 3])
  //  .map(function(a) { return a * 2; })
  //  .reverse().value(); // [6, 4, 2]
  // OOP 调用 chain
  //_([1, 2, 3])
  //  .chain()
  //  .map(function(a){ return a * 2; })
  //  .first()
  //  .value(); // 2
  //
    // 无论是否 OOP 调用，都会转为 OOP 形式(因为执行chain函数，如果有obj参数的话
    //会var instance = _(obj);其实跟OOP调用chain一样,只不过它先执行_(obj),后面都是会执行
    //instance._chain = true;所以这两种方法都一样)
    // 并且给新的构造对象添加了一个 _chain 属性
    var instance = _(obj);
    // 标记是否使用链式操作
    instance._chain = true;
    // 返回 OOP 对象
    // 可以看到该 instance 对象除了多了个 _chain 属性
    // 其他的和直接 _(obj) 的结果一样
    return instance;
  };
  
  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    // 如果需要链式操作，则对 obj 运行 _.chain 方法，使得可以继续后续的链式操作
    // 如果不需要，直接返回 obj
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  // 可向 underscore 函数库扩展自己的方法
  // obj 参数必须是一个对象（JavaScript 中一切皆对象）
  // 且自己的方法定义在 obj 的属性上
  // 如 obj.myFunc = function() {...}
  // 形如 {myFunc: function(){}}
  // 之后便可使用如下: _.myFunc(..) 或者 OOP _(..).myFunc(..)
  // 其实这样操作是把方法添加到原型上，_prop_就有这些方法
  _.mixin = function(obj) {
    // 取出对象的方法形成的数组
    _.each(_.functions(obj), function(name) {
      // 定义方法名的方法
      var func = _[name] = obj[name];
      // 添加到原型
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };
  
  // Add all of the Underscore functions to the wrapper object.
  // 将前面定义的 underscore 方法添加给包装过的对象
  // 即添加到 _.prototype 中
  // 使 underscore 支持面向对象形式的调用
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
   // 将 Array 原型链上有的方法都添加到 underscore 中
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      // 支持链式操作
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  // 添加 concat、join、slice 等数组原生方法给 Underscore
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  // 一个包装过(OOP)并且链式调用的对象
  // 用 value 方法获取结果
  // _(obj).value === obj?
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;
  
  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  // 兼容 AMD 规范
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

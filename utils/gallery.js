/**
 * 相册工具模块
 * 后台静默获取设备最新存入的一张图片（元数据，不加载图片）
 *
 * Android: 直接查询 MediaStore
 * iOS:     系统限制无法静默查询，返回 null
 */

// #ifdef APP-PLUS
function getLatestImage() {
  return new Promise((resolve) => {
    try {
      if (plus.os.name === 'Android') {
        resolve(getLatestImageAndroid())
      } else {
        console.log('[gallery] 非 Android 平台，跳过')
        resolve(null)
      }
    } catch (e) {
      console.error('[gallery] getLatestImage 异常:', e)
      resolve(null)
    }
  })
}

function getLatestImageAndroid() {
  try {
    console.log('[gallery] 开始查询 MediaStore...')

    const main = plus.android.runtimeMainActivity()
    const resolver = main.getContentResolver()

    const MediaStore = plus.android.importClass('android.provider.MediaStore')
    const uri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI

    const cols = [
      MediaStore.Images.Media.DATA,
      MediaStore.Images.Media.DATE_ADDED,
      MediaStore.Images.Media.SIZE,
      MediaStore.Images.Media.WIDTH,
      MediaStore.Images.Media.HEIGHT,
      MediaStore.Images.Media.DISPLAY_NAME,
    ]

    // 构造 Java String[]
    let projection
    try {
      projection = plus.android.newObject('java.lang.String[]', cols)
    } catch (e) {
      console.warn('[gallery] newObject 失败, fallback ArrayList:', e)
      const ArrayList = plus.android.importClass('java.util.ArrayList')
      const list = new ArrayList()
      cols.forEach(c => list.add(c))
      projection = list.toArray(plus.android.newObject('java.lang.String[]', []))
    }

    const sortOrder = MediaStore.Images.Media.DATE_ADDED + ' DESC'
    console.log('[gallery] 执行 query...')

    // resolver 上的方法必须用 invoke 调用
    const cursor = plus.android.invoke(
      resolver, 'query',
      uri, projection, null, null, sortOrder
    )
    console.log('[gallery] query 结果:', cursor ? '有Cursor' : 'null')

    if (!cursor) return null

    try {
      // invoke 拿到的 Cursor 也必须全程用 invoke
      const moved = plus.android.invoke(cursor, 'moveToFirst')
      console.log('[gallery] moveToFirst:', moved)

      if (moved) {
        // 辅助：取列索引再用 invoke 取值
        const idx = (col) => plus.android.invoke(cursor, 'getColumnIndex', col)
        const getStr = (col) => plus.android.invoke(cursor, 'getString', idx(col))
        const getLong = (col) => plus.android.invoke(cursor, 'getLong', idx(col))
        const getInt = (col) => plus.android.invoke(cursor, 'getInt', idx(col))

        const dataCol = MediaStore.Images.Media.DATA
        const dateCol = MediaStore.Images.Media.DATE_ADDED
        const sizeCol = MediaStore.Images.Media.SIZE
        const widthCol = MediaStore.Images.Media.WIDTH
        const heightCol = MediaStore.Images.Media.HEIGHT
        const nameCol = MediaStore.Images.Media.DISPLAY_NAME

        const path = getStr(dataCol)
        const dateAdded = getLong(dateCol)
        const size = getLong(sizeCol)
        const width = getInt(widthCol)
        const height = getInt(heightCol)
        const name = getStr(nameCol)

        console.log('[gallery] 图片:', path,
          '尺寸:', width + 'x' + height,
          '时间:', new Date(dateAdded * 1000).toLocaleString())

        return {
          path,
          timestamp: dateAdded * 1000,
          size,
          width,
          height,
          name,
          mime: '',
        }
      }
    } finally {
      plus.android.invoke(cursor, 'close')
    }

    console.log('[gallery] 未找到图片')
    return null
  } catch (e) {
    console.error('[gallery] getLatestImageAndroid 异常:', e.message, e)
    return null
  }
}
// #endif

// #ifndef APP-PLUS
function getLatestImage() {
  return Promise.resolve(null)
}
// #endif

export default {
  getLatestImage,
}

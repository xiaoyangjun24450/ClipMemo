/**
 * 图片处理工具模块
 * 将外部图片复制到 App 私有目录
 */

const IMAGE_SUB_DIR = 'clipmemo_images'

/**
 * 确保私有图片目录存在
 */
function ensureImageDir() {
  return new Promise((resolve) => {
    // #ifdef APP-PLUS
    plus.io.requestFileSystem(
      plus.io.PRIVATE_DOC,
      (fs) => {
        fs.root.getDirectory(
          IMAGE_SUB_DIR,
          { create: true },
          (dirEntry) => resolve(dirEntry),
          (e) => { console.error('[image-helper] 创建目录失败:', e); resolve(null) }
        )
      },
      (e) => { console.error('[image-helper] 获取文件系统失败:', e); resolve(null) }
    )
    // #endif
    // #ifndef APP-PLUS
    resolve(null)
    // #endif
  })
}

/**
 * 将外部图片复制到 App 私有目录
 * @param {string} srcPath 源图片绝对路径
 * @returns {Promise<{copiedPath: string}|null>}
 */
function copyToAppDir(srcPath) {
  return new Promise(async (resolve) => {
    // #ifdef APP-PLUS
    try {
      const dirEntry = await ensureImageDir()
      if (!dirEntry) { resolve(null); return }

      const timestamp = Date.now()
      const ext = getExtension(srcPath)
      const fileName = `img_${timestamp}${ext}`

      try {
        await copyFileToDir(srcPath, dirEntry, fileName)
      } catch (e) {
        console.error('[image-helper] 复制原图失败:', e)
        resolve(null)
        return
      }

      const copiedRelPath = `_doc/${IMAGE_SUB_DIR}/${fileName}`
      const copiedAbsPath = plus.io.convertLocalFileSystemURL(copiedRelPath)
      console.log('[image-helper] 图片复制成功:', copiedAbsPath)
      resolve({ copiedPath: copiedAbsPath })
    } catch (e) {
      console.error('[image-helper] copyToAppDir 异常:', e)
      resolve(null)
    }
    // #endif
    // #ifndef APP-PLUS
    resolve(null)
    // #endif
  })
}

/**
 * 复制文件到指定目录下
 */
function copyFileToDir(srcPath, dirEntry, newName) {
  return new Promise((resolve, reject) => {
    // #ifdef APP-PLUS
    plus.io.resolveLocalFileSystemURL(
      srcPath,
      (fileEntry) => {
        fileEntry.copyTo(dirEntry, newName, () => resolve(), (e) => reject(e))
      },
      (e) => reject(e)
    )
    // #endif
    // #ifndef APP-PLUS
    reject(new Error('非 APP-PLUS 平台'))
    // #endif
  })
}

function getExtension(path) {
  if (!path) return '.jpg'
  const idx = path.lastIndexOf('.')
  return idx > -1 ? path.substring(idx) : '.jpg'
}

export default { copyToAppDir }

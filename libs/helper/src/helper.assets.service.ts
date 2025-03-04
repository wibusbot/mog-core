import { Injectable } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { HttpService } from './helper.http.service';
import fs from 'fs';
import { isURL } from 'class-validator';
import { tmpdir } from 'os';
import { Readable } from 'stream';
import { lookup } from 'mime-types';
import { getFileInfo } from '~/shared/utils/files.util';
import { STORE_DIR } from '~/shared/constants/path.constant';
import { join } from 'path';

@Injectable()
export class AssetsService {
  constructor(private readonly http: HttpService) {}

  async downloadZIPAndExtract(url: string, _path: string, name?: string) {
    // 1. Check if the URL is valid.
    if (!isURL(url)) {
      throw new Error('Invalid URL');
    }
    // 2. Download the ZIP file.
    const res = await this.http.axiosRef(url, {
      responseType: 'arraybuffer',
    });
    // 3. Convert the downloaded data to a buffer.
    const buffer = Buffer.from(res.data, 'binary');
    // 4. Extract the ZIP file.
    await this.extractZIP(buffer, _path, name);
    return true;
  }

  async extractZIP(buffer: Buffer, _path: string, name?: string) {
    const zip = new AdmZip(buffer);
    const real = path.join(_path, name || zip.getEntries()[0].entryName);
    zip.extractAllTo(tmpdir(), true);
    try {
      fs.mkdirSync(real);
      fs.renameSync(path.join(tmpdir(), zip.getEntries()[0].entryName), real);
    } catch {
      // fs.renameSync(path.join(tmpdir(), zip.getEntries()[0].entryName), real);
      throw new Error('当前文件已存在，正在跳过');
    }
    return true;
  }

  async downloadFile(url: string, _path: string, name?: string) {
    if (!isURL(url)) {
      throw new Error('Invalid URL');
    }
    const res = await this.http.axiosRef(url, {
      responseType: 'arraybuffer',
    });
    const buffer = Buffer.from(res.data, 'binary');
    if (!name) {
      name = url.split('/').pop()!;
    }
    await this.writeFile(buffer, _path, name);
    return true;
  }

  async writeFile(buffer: Buffer, _path: string, name: string) {
    fs.writeFileSync(path.join(_path, name), buffer);
    return {
      name,
    };
  }

  async uploadZIPAndExtract(buffer: Buffer, _path: string, name?: string) {
    await this.extractZIP(buffer, _path, name);
    return true;
  }

  async deleteFile(path: string) {
    path = join(STORE_DIR, path);
    if (path === '/') {
      throw new Error('Cannot delete root directory');
    }
    fs.rmSync(path, { recursive: true });
    return true;
  }

  async getFile(_path: string) {
    const file = fs.readFileSync(_path);
    const name = _path.split('/').pop()!;
    const ext = path.extname(name);
    const mimetype = lookup(ext);
    return {
      file,
      name,
      ext,
      mimetype,
    };
  }

  async getFileList(_path: string) {


    const files = fs.readdirSync(_path);
    const fileList = files.map((file) => {
      const filePath = path.join(_path, file);
      return getFileInfo(filePath);
    });
    return fileList;
  }

  async mkdir(path: string) {
    fs.mkdirSync(path);
    return true;
  }

  exists(path: string) {
    return fs.existsSync(path);
  }

  async writeReadableFile(
    readable: Readable,
    _path: string,
    name: string,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const filePath = path.join(_path, name);
      if (this.exists(filePath)) {
        reject(new Error('File already exists'));
        return;
      }
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const writable = fs.createWriteStream(filePath, {
        encoding: 'utf-8',
      });
      readable.pipe(writable);
      writable.on('close', () => {
        resolve(true);
      });
      writable.on('error', () => reject(null));
      readable.on('end', () => {
        writable.end();
      });
      readable.on('error', () => reject(null));
    });
  }

  async rename(oldPath: string, newPath: string) {
    fs.renameSync(oldPath, newPath);
    return true;
  }

  async createFile(_path: string, name: string, content?: string | Buffer) {
    if (typeof content === 'object') {
      content = JSON.stringify(content);
    }
    const filePath = path.join(_path, name);
    if (this.exists(filePath)) {
      throw new Error('File already exists');
    }
    fs.writeFileSync(filePath, content || '');
    return true;
  }
}

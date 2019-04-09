import { Buffer } from 'buffer'

/**
 * 超时单位
 */
export enum TimeoutUnit {
    MicroSecend,
    MicroSecend10,
    MicroSecend100,
    Secend,
    Min,
    Hour,
    Day,
}
/**
 * 请求类型
 */
export enum RPCType {
    //请求
    Request,
    //响应
    Response,
    //推送
    Push,
    //更换地址
    Move,
    //转发
    Proxy,
    //心跳请求
    Ping,
    //心跳响应
    Pong,
    //登陆
    Login,
    //服务注册,Data==true表示注册，Data==false表示反注册
    Regist,
    //发布
    Pub,
    //订阅
    Sub,
    //取消订阅
    UnSub,
}

export enum DataType {
    Buffer,
    JSON,
    Boolean,
    Number,
    String,
    UNKNOW,
}
export function checkTopic(topic: string): string {
    if ('string' != typeof topic) { throw 'ErrorTopic' }
    if (/^[A-Za-z0-9][A-Za-z0-9\+\/\$\#]{0,}$/g.test(topic)) {
        return '^' + topic.replace(/\$/g, '[A-Za-z0-9]').replace(/\+/g, '[A-Za-z0-9]{1,}').replace(/\#/g, '[A-Za-z0-9\\/]') + '$'
    }
    throw 'ErrorTopic'
}

export default class RPC {
    /**
     * 需要地址的类型
     */
    static NeedAddressType = [RPCType.Login, RPCType.Proxy, RPCType.Move];
    /** 
	* 版本号
	*/
    Version: number = 0;
    /** 
	* 发送方
	*/
    From: string | Buffer = "";
    /** 
	* 接收方
	*/
    To: string | Buffer = "";
    /** 
	* 是否需要回复，若不需要回复这不创建Promise，否则创建Promise并控制超时逻辑
	*/
    NeedReply: boolean = true;
    /** 
	* 响应状态，成功、失败
	*/
    Status: boolean = true;
    /** 
	* 超时时间，默认为秒
	*/
    Timeout: number = 0;
    /**
     * 超时时间
     */
    TimeoutUnit: TimeoutUnit = TimeoutUnit.Secend
    /** 
    * 请求编号，不得超过255
    */
    ID: number = 0;
    /** 
	* 请求路径，长度不得超过32
	*/
    Path: string = ''
    /** 
	* 请求类型
	*/
    Type: RPCType = RPCType.Ping
    /** 
	* 数据内容
	*/
    Data: Object | string | Buffer = ''

    /** 
	* 响应状态，成功、失败
	*/
    encode() {
        if (this.Path.length > 255 && this.Path.length == 0) {
            throw new Error('Error Path')
        }
        //预留7个字节
        let b = Buffer.alloc(10)
        b[0] = this.Version;
        b[1] |= this.NeedReply ? 0x80 : 0x00
        b[1] |= this.Status ? 0x40 : 0x00
        //TODO 嵌入是否包含接收方和发送方地址数据，2位
        b[2] = this.Type;
        //写入超时单位
        b[3] = this.TimeoutUnit;
        //写入超时时间
        b[4] = this.Timeout;

        //写入seqID
        b[5] = this.ID;
        // b[2] |= this.IsUp ? 0x80 : 0x00;
        b[6] = this.Path.length
        b[7] = RPC.getDataType(this.Data);
        //开始编码时间和请求类型数据
        let addr = Buffer.alloc(0);
        if (RPC.NeedAddressType.includes(this.Type)) {
            //写入16字节的地址数据
            //低1位发送方，低2位接收方
            // b[1] |= 0x04;
            b[1] |= (Buffer.isBuffer(this.From) ? 0x01 : 0x00)
            b[1] |= (Buffer.isBuffer(this.To) ? 0x02 : 0x00)
            addr = Buffer.concat([
                Buffer.isBuffer(this.From) ? this.From : Buffer.from(this.From),
                Buffer.isBuffer(this.To) ? this.To : Buffer.from(this.To),
            ]);
        }
        // 需要标识数据类型用于做解码
        let data = RPC.encodeData(this.Data, b[7]);
        return Buffer.concat([
            Buffer.from([0x68]),
            b,
            addr,
            Buffer.from(this.Path),
            Buffer.isBuffer(data) ? data : Buffer.from('string' == typeof data ? data : data.toString()),
            Buffer.from([0x68]),
        ])
    }
    static getDataType(data: any): DataType {
        if (data instanceof Buffer) {
            return DataType.Buffer
        } else if ('number' == typeof data) {
            return DataType.Number
        } else if ('boolean' == typeof data) {
            return DataType.Boolean
        } else if ('string' == typeof data) {
            return DataType.String
        } else if ('object' == typeof data) {
            return DataType.JSON;
        }
        return DataType.UNKNOW
    }
    static encodeData(data: any, type: number) {
        switch (type) {
            case DataType.JSON:
                return JSON.stringify(data);
            case DataType.Boolean:
                return data ? 1 : 0;
            default:
                return data.toString()
        }
    }
    static decodeData(data: Buffer, type: number) {
        switch (type) {
            case DataType.JSON:
                return JSON.parse(data.toString())
                break;
            case DataType.Boolean:
                return data.toString() == '1'
                break;
            case DataType.Number:
                return Number(data.toString())
                break;
            case DataType.String:
                return data.toString()
                break;
            case DataType.Buffer:
                // t.Data=
                return data;
                break;
            default:
                return data;
                break;
        }
    }
    static decode(b: Buffer) {
        if (b[0] !== 0x68 || b[b.length - 1] !== 0x68) { throw 'ErrorPacket' }
        b = b.slice(1, b.length - 1)
        let t = new RPC()
        t.Version = b[0];
        t.NeedReply = (b[1] & 0x80) == 0x80
        t.Status = (b[1] & 0x40) == 0x40
        t.Timeout = b[4];
        t.TimeoutUnit = b[3];
        t.ID = b[5];
        t.Type = b[2]
        let start = 10;
        if (RPC.NeedAddressType.includes(t.Type)) {
            t.From = (b[1] & 0x01) > 0 ? b.slice(start, start + 8) : b.slice(start, start + 8).toString().trim();
            start += 8;
            t.To = (b[1] & 0x02) > 0 ? b.slice(start, start + 8) : b.slice(start, start + 8).toString().trim();
            start += 8;
        }
        //预留3个字节不处理
        t.Path = b.slice(start, b[6] + start).toString()
        t.Data = RPC.decodeData(b.slice(start + b[6]), b[7]);
        return t;
    }
}
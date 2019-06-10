import RPC, { TimeoutUnit } from './index'
import { Buffer } from 'buffer';
var s = new RPC()
s.Version = 1;
s.Data = '015f2e5f'
s.Path = "fwei/fwjeof"
s.Timeout = 10;
s.TimeoutUnit = TimeoutUnit.Hour;
s.ID = 1;
var b = s.encode();
var a = RPC.decode(b);
console.log(a.ID == s.ID, a.Data == s.Data, a.Path == s.Path, a.From == s.From, a.Timeout == s.Timeout, s.TimeoutUnit == a.TimeoutUnit)

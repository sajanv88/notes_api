export function readIEEE754(buffer, offset, endian, mLen, nBytes) {
    let e;
    let m;
    const bBE = endian === "big";
    const eLen = nBytes * 8 - mLen - 1;
    const eMax = (1 << eLen) - 1;
    const eBias = eMax >> 1;
    let nBits = -7;
    let i = bBE ? 0 : nBytes - 1;
    const d = bBE ? 1 : -1;
    let s = buffer[offset + i];
    i += d;
    e = s & ((1 << -nBits) - 1);
    s >>= -nBits;
    nBits += eLen;
    for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8)
        ;
    m = e & ((1 << -nBits) - 1);
    e >>= -nBits;
    nBits += mLen;
    for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8)
        ;
    if (e === 0) {
        e = 1 - eBias;
    }
    else if (e === eMax) {
        return m ? NaN : (s ? -1 : 1) * Infinity;
    }
    else {
        m = m + Math.pow(2, mLen);
        e = e - eBias;
    }
    return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
}
export function writeIEEE754(buffer, value, offset, endian, mLen, nBytes) {
    let e;
    let m;
    let c;
    const bBE = endian === "big";
    let eLen = nBytes * 8 - mLen - 1;
    const eMax = (1 << eLen) - 1;
    const eBias = eMax >> 1;
    const rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
    let i = bBE ? nBytes - 1 : 0;
    const d = bBE ? -1 : 1;
    const s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;
    value = Math.abs(value);
    if (isNaN(value) || value === Infinity) {
        m = isNaN(value) ? 1 : 0;
        e = eMax;
    }
    else {
        e = Math.floor(Math.log(value) / Math.LN2);
        if (value * (c = Math.pow(2, -e)) < 1) {
            e--;
            c *= 2;
        }
        if (e + eBias >= 1) {
            value += rt / c;
        }
        else {
            value += rt * Math.pow(2, 1 - eBias);
        }
        if (value * c >= 2) {
            e++;
            c /= 2;
        }
        if (e + eBias >= eMax) {
            m = 0;
            e = eMax;
        }
        else if (e + eBias >= 1) {
            m = (value * c - 1) * Math.pow(2, mLen);
            e = e + eBias;
        }
        else {
            m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
            e = 0;
        }
    }
    if (isNaN(value))
        m = 0;
    while (mLen >= 8) {
        buffer[offset + i] = m & 0xff;
        i += d;
        m /= 256;
        mLen -= 8;
    }
    e = (e << mLen) | m;
    if (isNaN(value))
        e += 8;
    eLen += mLen;
    while (eLen > 0) {
        buffer[offset + i] = e & 0xff;
        i += d;
        e /= 256;
        eLen -= 8;
    }
    buffer[offset + i - d] |= s * 128;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxvYXRfcGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZmxvYXRfcGFyc2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQWtDQSxNQUFNLFVBQVUsV0FBVyxDQUN6QixNQUF5QixFQUN6QixNQUFjLEVBQ2QsTUFBd0IsRUFDeEIsSUFBWSxFQUNaLE1BQWM7SUFFZCxJQUFJLENBQVMsQ0FBQztJQUNkLElBQUksQ0FBUyxDQUFDO0lBQ2QsTUFBTSxHQUFHLEdBQUcsTUFBTSxLQUFLLEtBQUssQ0FBQztJQUM3QixNQUFNLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLENBQUM7SUFDbkMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzdCLE1BQU0sS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLENBQUM7SUFDeEIsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDZixJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUM3QixNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkIsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztJQUUzQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBRVAsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDNUIsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDO0lBQ2IsS0FBSyxJQUFJLElBQUksQ0FBQztJQUNkLE9BQU8sS0FBSyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxNQUFN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QUcsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN2RCxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ1A7S0FDRjtJQUVELElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQztRQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7SUFFeEIsT0FBTyxJQUFJLElBQUksQ0FBQyxFQUFFO1FBQ2hCLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUM5QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ1AsQ0FBQyxJQUFJLEdBQUcsQ0FBQztRQUNULElBQUksSUFBSSxDQUFDLENBQUM7S0FDWDtJQUVELENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFFcEIsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV6QixJQUFJLElBQUksSUFBSSxDQUFDO0lBRWIsT0FBTyxJQUFJLEdBQUcsQ0FBQyxFQUFFO1FBQ2YsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQzlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDUCxDQUFDLElBQUksR0FBRyxDQUFDO1FBQ1QsSUFBSSxJQUFJLENBQUMsQ0FBQztLQUNYO0lBRUQsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUNwQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IChjKSAyMDA4LCBGYWlyIE9ha3MgTGFicywgSW5jLlxuLy8gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbi8vXG4vLyBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbi8vIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuLy9cbi8vICAqIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbi8vICAgIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4vL1xuLy8gICogUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuLy8gICAgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvblxuLy8gICAgYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4vL1xuLy8gICogTmVpdGhlciB0aGUgbmFtZSBvZiBGYWlyIE9ha3MgTGFicywgSW5jLiBub3IgdGhlIG5hbWVzIG9mIGl0cyBjb250cmlidXRvcnNcbi8vICAgIG1heSBiZSB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0cyBkZXJpdmVkIGZyb20gdGhpcyBzb2Z0d2FyZVxuLy8gICAgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXG4vL1xuLy8gVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQ09QWVJJR0hUIEhPTERFUlMgQU5EIENPTlRSSUJVVE9SUyBcIkFTIElTXCJcbi8vIEFORCBBTlkgRVhQUkVTUyBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEVcbi8vIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFXG4vLyBBUkUgRElTQ0xBSU1FRC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBDT1BZUklHSFQgT1dORVIgT1IgQ09OVFJJQlVUT1JTIEJFXG4vLyBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SXG4vLyBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRlxuLy8gU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTXG4vLyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GIExJQUJJTElUWSwgV0hFVEhFUiBJTlxuLy8gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElORyBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSlcbi8vIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLCBFVkVOIElGIEFEVklTRUQgT0YgVEhFXG4vLyBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbi8vXG4vL1xuLy8gTW9kaWZpY2F0aW9ucyB0byB3cml0ZUlFRUU3NTQgdG8gc3VwcG9ydCBuZWdhdGl2ZSB6ZXJvZXMgbWFkZSBieSBCcmlhbiBXaGl0ZVxuXG50eXBlIE51bWVyaWNhbFNlcXVlbmNlID0geyBbaW5kZXg6IG51bWJlcl06IG51bWJlciB9O1xuXG5leHBvcnQgZnVuY3Rpb24gcmVhZElFRUU3NTQoXG4gIGJ1ZmZlcjogTnVtZXJpY2FsU2VxdWVuY2UsXG4gIG9mZnNldDogbnVtYmVyLFxuICBlbmRpYW46IFwiYmlnXCIgfCBcImxpdHRsZVwiLFxuICBtTGVuOiBudW1iZXIsXG4gIG5CeXRlczogbnVtYmVyLFxuKTogbnVtYmVyIHtcbiAgbGV0IGU6IG51bWJlcjtcbiAgbGV0IG06IG51bWJlcjtcbiAgY29uc3QgYkJFID0gZW5kaWFuID09PSBcImJpZ1wiO1xuICBjb25zdCBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxO1xuICBjb25zdCBlTWF4ID0gKDEgPDwgZUxlbikgLSAxO1xuICBjb25zdCBlQmlhcyA9IGVNYXggPj4gMTtcbiAgbGV0IG5CaXRzID0gLTc7XG4gIGxldCBpID0gYkJFID8gMCA6IG5CeXRlcyAtIDE7XG4gIGNvbnN0IGQgPSBiQkUgPyAxIDogLTE7XG4gIGxldCBzID0gYnVmZmVyW29mZnNldCArIGldO1xuXG4gIGkgKz0gZDtcblxuICBlID0gcyAmICgoMSA8PCAtbkJpdHMpIC0gMSk7XG4gIHMgPj49IC1uQml0cztcbiAgbkJpdHMgKz0gZUxlbjtcbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCk7XG5cbiAgbSA9IGUgJiAoKDEgPDwgLW5CaXRzKSAtIDEpO1xuICBlID4+PSAtbkJpdHM7XG4gIG5CaXRzICs9IG1MZW47XG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpO1xuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhcztcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAocyA/IC0xIDogMSkgKiBJbmZpbml0eTtcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pO1xuICAgIGUgPSBlIC0gZUJpYXM7XG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUlFRUU3NTQoXG4gIGJ1ZmZlcjogTnVtZXJpY2FsU2VxdWVuY2UsXG4gIHZhbHVlOiBudW1iZXIsXG4gIG9mZnNldDogbnVtYmVyLFxuICBlbmRpYW46IFwiYmlnXCIgfCBcImxpdHRsZVwiLFxuICBtTGVuOiBudW1iZXIsXG4gIG5CeXRlczogbnVtYmVyLFxuKTogdm9pZCB7XG4gIGxldCBlOiBudW1iZXI7XG4gIGxldCBtOiBudW1iZXI7XG4gIGxldCBjOiBudW1iZXI7XG4gIGNvbnN0IGJCRSA9IGVuZGlhbiA9PT0gXCJiaWdcIjtcbiAgbGV0IGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDE7XG4gIGNvbnN0IGVNYXggPSAoMSA8PCBlTGVuKSAtIDE7XG4gIGNvbnN0IGVCaWFzID0gZU1heCA+PiAxO1xuICBjb25zdCBydCA9IG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwO1xuICBsZXQgaSA9IGJCRSA/IG5CeXRlcyAtIDEgOiAwO1xuICBjb25zdCBkID0gYkJFID8gLTEgOiAxO1xuICBjb25zdCBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwO1xuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpO1xuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwO1xuICAgIGUgPSBlTWF4O1xuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKTtcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS07XG4gICAgICBjICo9IDI7XG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcyk7XG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrO1xuICAgICAgYyAvPSAyO1xuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDA7XG4gICAgICBlID0gZU1heDtcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbik7XG4gICAgICBlID0gZSArIGVCaWFzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbik7XG4gICAgICBlID0gMDtcbiAgICB9XG4gIH1cblxuICBpZiAoaXNOYU4odmFsdWUpKSBtID0gMDtcblxuICB3aGlsZSAobUxlbiA+PSA4KSB7XG4gICAgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmY7XG4gICAgaSArPSBkO1xuICAgIG0gLz0gMjU2O1xuICAgIG1MZW4gLT0gODtcbiAgfVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG07XG5cbiAgaWYgKGlzTmFOKHZhbHVlKSkgZSArPSA4O1xuXG4gIGVMZW4gKz0gbUxlbjtcblxuICB3aGlsZSAoZUxlbiA+IDApIHtcbiAgICBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZjtcbiAgICBpICs9IGQ7XG4gICAgZSAvPSAyNTY7XG4gICAgZUxlbiAtPSA4O1xuICB9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4O1xufVxuIl19
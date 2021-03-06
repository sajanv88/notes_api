export var OpCode;
(function (OpCode) {
    OpCode[OpCode["REPLAY"] = 1] = "REPLAY";
    OpCode[OpCode["UPDATE"] = 2001] = "UPDATE";
    OpCode[OpCode["INSERT"] = 2002] = "INSERT";
    OpCode[OpCode["RESERVED"] = 2003] = "RESERVED";
    OpCode[OpCode["QUERY"] = 2004] = "QUERY";
    OpCode[OpCode["GET_MORE"] = 2005] = "GET_MORE";
    OpCode[OpCode["DELETE"] = 2006] = "DELETE";
    OpCode[OpCode["KILL_CURSORS"] = 2007] = "KILL_CURSORS";
    OpCode[OpCode["MSG"] = 2013] = "MSG";
})(OpCode || (OpCode = {}));
export function setHeader(view, header) {
    view.setInt32(0, header.messageLength, true);
    view.setInt32(4, header.requestId, true);
    view.setInt32(8, header.responseTo, true);
    view.setInt32(12, header.opCode, true);
}
export function parseHeader(buffer) {
    const view = new DataView(buffer.buffer);
    return {
        messageLength: view.getUint32(0, true),
        requestId: view.getUint32(4, true),
        responseTo: view.getUint32(8, true),
        opCode: view.getUint32(12, true),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVhZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaGVhZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sQ0FBTixJQUFZLE1BVVg7QUFWRCxXQUFZLE1BQU07SUFDaEIsdUNBQVUsQ0FBQTtJQUNWLDBDQUFhLENBQUE7SUFDYiwwQ0FBYSxDQUFBO0lBQ2IsOENBQWUsQ0FBQTtJQUNmLHdDQUFZLENBQUE7SUFDWiw4Q0FBZSxDQUFBO0lBQ2YsMENBQWEsQ0FBQTtJQUNiLHNEQUFtQixDQUFBO0lBQ25CLG9DQUFVLENBQUE7QUFDWixDQUFDLEVBVlcsTUFBTSxLQUFOLE1BQU0sUUFVakI7QUFTRCxNQUFNLFVBQVUsU0FBUyxDQUN2QixJQUFjLEVBQ2QsTUFBcUI7SUFFckIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM3QyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3pDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDMUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN6QyxDQUFDO0FBRUQsTUFBTSxVQUFVLFdBQVcsQ0FBQyxNQUFrQjtJQUM1QyxNQUFNLElBQUksR0FBRyxJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDekMsT0FBTztRQUNMLGFBQWEsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUM7UUFDdEMsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQztRQUNsQyxVQUFVLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDO1FBQ25DLE1BQU0sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUM7S0FDakMsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZW51bSBPcENvZGUge1xuICBSRVBMQVkgPSAxLFxuICBVUERBVEUgPSAyMDAxLFxuICBJTlNFUlQgPSAyMDAyLFxuICBSRVNFUlZFRCA9IDIwMDMsXG4gIFFVRVJZID0gMjAwNCxcbiAgR0VUX01PUkUgPSAyMDA1LFxuICBERUxFVEUgPSAyMDA2LFxuICBLSUxMX0NVUlNPUlMgPSAyMDA3LFxuICBNU0cgPSAyMDEzLFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE1lc3NhZ2VIZWFkZXIge1xuICBtZXNzYWdlTGVuZ3RoOiBudW1iZXI7XG4gIHJlcXVlc3RJZDogbnVtYmVyO1xuICByZXNwb25zZVRvOiBudW1iZXI7XG4gIG9wQ29kZTogT3BDb2RlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0SGVhZGVyKFxuICB2aWV3OiBEYXRhVmlldyxcbiAgaGVhZGVyOiBNZXNzYWdlSGVhZGVyLFxuKSB7XG4gIHZpZXcuc2V0SW50MzIoMCwgaGVhZGVyLm1lc3NhZ2VMZW5ndGgsIHRydWUpO1xuICB2aWV3LnNldEludDMyKDQsIGhlYWRlci5yZXF1ZXN0SWQsIHRydWUpO1xuICB2aWV3LnNldEludDMyKDgsIGhlYWRlci5yZXNwb25zZVRvLCB0cnVlKTtcbiAgdmlldy5zZXRJbnQzMigxMiwgaGVhZGVyLm9wQ29kZSwgdHJ1ZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUhlYWRlcihidWZmZXI6IFVpbnQ4QXJyYXkpOiBNZXNzYWdlSGVhZGVyIHtcbiAgY29uc3QgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIuYnVmZmVyKTtcbiAgcmV0dXJuIHtcbiAgICBtZXNzYWdlTGVuZ3RoOiB2aWV3LmdldFVpbnQzMigwLCB0cnVlKSxcbiAgICByZXF1ZXN0SWQ6IHZpZXcuZ2V0VWludDMyKDQsIHRydWUpLFxuICAgIHJlc3BvbnNlVG86IHZpZXcuZ2V0VWludDMyKDgsIHRydWUpLFxuICAgIG9wQ29kZTogdmlldy5nZXRVaW50MzIoMTIsIHRydWUpLFxuICB9O1xufVxuIl19
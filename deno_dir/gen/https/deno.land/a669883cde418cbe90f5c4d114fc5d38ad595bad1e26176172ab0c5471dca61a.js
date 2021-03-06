const FIRST_BIT = 0x80;
const FIRST_TWO_BITS = 0xc0;
const FIRST_THREE_BITS = 0xe0;
const FIRST_FOUR_BITS = 0xf0;
const FIRST_FIVE_BITS = 0xf8;
const TWO_BIT_CHAR = 0xc0;
const THREE_BIT_CHAR = 0xe0;
const FOUR_BIT_CHAR = 0xf0;
const CONTINUING_CHAR = 0x80;
export function validateUtf8(bytes, start, end) {
    let continuation = 0;
    for (let i = start; i < end; i += 1) {
        const byte = bytes[i];
        if (continuation) {
            if ((byte & FIRST_TWO_BITS) !== CONTINUING_CHAR) {
                return false;
            }
            continuation -= 1;
        }
        else if (byte & FIRST_BIT) {
            if ((byte & FIRST_THREE_BITS) === TWO_BIT_CHAR) {
                continuation = 1;
            }
            else if ((byte & FIRST_FOUR_BITS) === THREE_BIT_CHAR) {
                continuation = 2;
            }
            else if ((byte & FIRST_FIVE_BITS) === FOUR_BIT_CHAR) {
                continuation = 3;
            }
            else {
                return false;
            }
        }
    }
    return !continuation;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGVfdXRmOC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZhbGlkYXRlX3V0ZjgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDO0FBQ3ZCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQztBQUM1QixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQztBQUM5QixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUM7QUFDN0IsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDO0FBRTdCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQztBQUMxQixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUM7QUFDNUIsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDO0FBQzNCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQztBQVE3QixNQUFNLFVBQVUsWUFBWSxDQUMxQixLQUFrQyxFQUNsQyxLQUFhLEVBQ2IsR0FBVztJQUVYLElBQUksWUFBWSxHQUFHLENBQUMsQ0FBQztJQUVyQixLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDbkMsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRXRCLElBQUksWUFBWSxFQUFFO1lBQ2hCLElBQUksQ0FBQyxJQUFJLEdBQUcsY0FBYyxDQUFDLEtBQUssZUFBZSxFQUFFO2dCQUMvQyxPQUFPLEtBQUssQ0FBQzthQUNkO1lBQ0QsWUFBWSxJQUFJLENBQUMsQ0FBQztTQUNuQjthQUFNLElBQUksSUFBSSxHQUFHLFNBQVMsRUFBRTtZQUMzQixJQUFJLENBQUMsSUFBSSxHQUFHLGdCQUFnQixDQUFDLEtBQUssWUFBWSxFQUFFO2dCQUM5QyxZQUFZLEdBQUcsQ0FBQyxDQUFDO2FBQ2xCO2lCQUFNLElBQUksQ0FBQyxJQUFJLEdBQUcsZUFBZSxDQUFDLEtBQUssY0FBYyxFQUFFO2dCQUN0RCxZQUFZLEdBQUcsQ0FBQyxDQUFDO2FBQ2xCO2lCQUFNLElBQUksQ0FBQyxJQUFJLEdBQUcsZUFBZSxDQUFDLEtBQUssYUFBYSxFQUFFO2dCQUNyRCxZQUFZLEdBQUcsQ0FBQyxDQUFDO2FBQ2xCO2lCQUFNO2dCQUNMLE9BQU8sS0FBSyxDQUFDO2FBQ2Q7U0FDRjtLQUNGO0lBRUQsT0FBTyxDQUFDLFlBQVksQ0FBQztBQUN2QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgRklSU1RfQklUID0gMHg4MDtcbmNvbnN0IEZJUlNUX1RXT19CSVRTID0gMHhjMDtcbmNvbnN0IEZJUlNUX1RIUkVFX0JJVFMgPSAweGUwO1xuY29uc3QgRklSU1RfRk9VUl9CSVRTID0gMHhmMDtcbmNvbnN0IEZJUlNUX0ZJVkVfQklUUyA9IDB4Zjg7XG5cbmNvbnN0IFRXT19CSVRfQ0hBUiA9IDB4YzA7XG5jb25zdCBUSFJFRV9CSVRfQ0hBUiA9IDB4ZTA7XG5jb25zdCBGT1VSX0JJVF9DSEFSID0gMHhmMDtcbmNvbnN0IENPTlRJTlVJTkdfQ0hBUiA9IDB4ODA7XG5cbi8qKlxuICogRGV0ZXJtaW5lcyBpZiB0aGUgcGFzc2VkIGluIGJ5dGVzIGFyZSB2YWxpZCB1dGY4XG4gKiBAcGFyYW0gYnl0ZXMgLSBBbiBhcnJheSBvZiA4LWJpdCBieXRlcy4gTXVzdCBiZSBpbmRleGFibGUgYW5kIGhhdmUgbGVuZ3RoIHByb3BlcnR5XG4gKiBAcGFyYW0gc3RhcnQgLSBUaGUgaW5kZXggdG8gc3RhcnQgdmFsaWRhdGluZ1xuICogQHBhcmFtIGVuZCAtIFRoZSBpbmRleCB0byBlbmQgdmFsaWRhdGluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVVdGY4KFxuICBieXRlczogeyBbaW5kZXg6IG51bWJlcl06IG51bWJlciB9LFxuICBzdGFydDogbnVtYmVyLFxuICBlbmQ6IG51bWJlcixcbik6IGJvb2xlYW4ge1xuICBsZXQgY29udGludWF0aW9uID0gMDtcblxuICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMSkge1xuICAgIGNvbnN0IGJ5dGUgPSBieXRlc1tpXTtcblxuICAgIGlmIChjb250aW51YXRpb24pIHtcbiAgICAgIGlmICgoYnl0ZSAmIEZJUlNUX1RXT19CSVRTKSAhPT0gQ09OVElOVUlOR19DSEFSKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGNvbnRpbnVhdGlvbiAtPSAxO1xuICAgIH0gZWxzZSBpZiAoYnl0ZSAmIEZJUlNUX0JJVCkge1xuICAgICAgaWYgKChieXRlICYgRklSU1RfVEhSRUVfQklUUykgPT09IFRXT19CSVRfQ0hBUikge1xuICAgICAgICBjb250aW51YXRpb24gPSAxO1xuICAgICAgfSBlbHNlIGlmICgoYnl0ZSAmIEZJUlNUX0ZPVVJfQklUUykgPT09IFRIUkVFX0JJVF9DSEFSKSB7XG4gICAgICAgIGNvbnRpbnVhdGlvbiA9IDI7XG4gICAgICB9IGVsc2UgaWYgKChieXRlICYgRklSU1RfRklWRV9CSVRTKSA9PT0gRk9VUl9CSVRfQ0hBUikge1xuICAgICAgICBjb250aW51YXRpb24gPSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiAhY29udGludWF0aW9uO1xufVxuIl19
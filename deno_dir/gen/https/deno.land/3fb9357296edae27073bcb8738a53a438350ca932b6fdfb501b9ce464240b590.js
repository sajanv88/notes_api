export const BSON_INT32_MAX = 0x7fffffff;
export const BSON_INT32_MIN = -0x80000000;
export const JS_INT_MAX = 2 ** 53;
export const JS_INT_MIN = -(2 ** 53);
export var BSONData;
(function (BSONData) {
    BSONData[BSONData["NUMBER"] = 1] = "NUMBER";
    BSONData[BSONData["STRING"] = 2] = "STRING";
    BSONData[BSONData["OBJECT"] = 3] = "OBJECT";
    BSONData[BSONData["ARRAY"] = 4] = "ARRAY";
    BSONData[BSONData["BINARY"] = 5] = "BINARY";
    BSONData[BSONData["UNDEFINED"] = 6] = "UNDEFINED";
    BSONData[BSONData["OID"] = 7] = "OID";
    BSONData[BSONData["BOOLEAN"] = 8] = "BOOLEAN";
    BSONData[BSONData["DATE"] = 9] = "DATE";
    BSONData[BSONData["NULL"] = 10] = "NULL";
    BSONData[BSONData["REGEXP"] = 11] = "REGEXP";
    BSONData[BSONData["DBPOINTER"] = 12] = "DBPOINTER";
    BSONData[BSONData["CODE"] = 13] = "CODE";
    BSONData[BSONData["SYMBOL"] = 14] = "SYMBOL";
    BSONData[BSONData["CODE_W_SCOPE"] = 15] = "CODE_W_SCOPE";
    BSONData[BSONData["INT"] = 16] = "INT";
    BSONData[BSONData["TIMESTAMP"] = 17] = "TIMESTAMP";
    BSONData[BSONData["LONG"] = 18] = "LONG";
    BSONData[BSONData["DECIMAL128"] = 19] = "DECIMAL128";
    BSONData[BSONData["MIN_KEY"] = 255] = "MIN_KEY";
    BSONData[BSONData["MAX_KEY"] = 127] = "MAX_KEY";
})(BSONData || (BSONData = {}));
export const BSON_BINARY_SUBTYPE_DEFAULT = 0;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29uc3RhbnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBRyxVQUFVLENBQUM7QUFFekMsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLENBQUMsVUFBVSxDQUFDO0FBTTFDLE1BQU0sQ0FBQyxNQUFNLFVBQVUsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0FBTWxDLE1BQU0sQ0FBQyxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBRXJDLE1BQU0sQ0FBTixJQUFrQixRQXNCakI7QUF0QkQsV0FBa0IsUUFBUTtJQUN4QiwyQ0FBVSxDQUFBO0lBQ1YsMkNBQVUsQ0FBQTtJQUNWLDJDQUFVLENBQUE7SUFDVix5Q0FBUyxDQUFBO0lBQ1QsMkNBQVUsQ0FBQTtJQUNWLGlEQUFhLENBQUE7SUFDYixxQ0FBTyxDQUFBO0lBQ1AsNkNBQVcsQ0FBQTtJQUNYLHVDQUFRLENBQUE7SUFDUix3Q0FBUyxDQUFBO0lBQ1QsNENBQVcsQ0FBQTtJQUNYLGtEQUFjLENBQUE7SUFDZCx3Q0FBUyxDQUFBO0lBQ1QsNENBQVcsQ0FBQTtJQUNYLHdEQUFpQixDQUFBO0lBQ2pCLHNDQUFRLENBQUE7SUFDUixrREFBYyxDQUFBO0lBQ2Qsd0NBQVMsQ0FBQTtJQUNULG9EQUFlLENBQUE7SUFDZiwrQ0FBYyxDQUFBO0lBQ2QsK0NBQWMsQ0FBQTtBQUNoQixDQUFDLEVBdEJpQixRQUFRLEtBQVIsUUFBUSxRQXNCekI7QUFHRCxNQUFNLENBQUMsTUFBTSwyQkFBMkIsR0FBRyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiogQGludGVybmFsICovXG5leHBvcnQgY29uc3QgQlNPTl9JTlQzMl9NQVggPSAweDdmZmZmZmZmO1xuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGNvbnN0IEJTT05fSU5UMzJfTUlOID0gLTB4ODAwMDAwMDA7XG5cbi8qKlxuICogQW55IGludGVnZXIgdXAgdG8gMl41MyBjYW4gYmUgcHJlY2lzZWx5IHJlcHJlc2VudGVkIGJ5IGEgZG91YmxlLlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCBjb25zdCBKU19JTlRfTUFYID0gMiAqKiA1MztcblxuLyoqXG4gKiBBbnkgaW50ZWdlciBkb3duIHRvIC0yXjUzIGNhbiBiZSBwcmVjaXNlbHkgcmVwcmVzZW50ZWQgYnkgYSBkb3VibGUuXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGNvbnN0IEpTX0lOVF9NSU4gPSAtKDIgKiogNTMpO1xuXG5leHBvcnQgY29uc3QgZW51bSBCU09ORGF0YSB7XG4gIE5VTUJFUiA9IDEsXG4gIFNUUklORyA9IDIsXG4gIE9CSkVDVCA9IDMsXG4gIEFSUkFZID0gNCxcbiAgQklOQVJZID0gNSxcbiAgVU5ERUZJTkVEID0gNixcbiAgT0lEID0gNyxcbiAgQk9PTEVBTiA9IDgsXG4gIERBVEUgPSA5LFxuICBOVUxMID0gMTAsXG4gIFJFR0VYUCA9IDExLFxuICBEQlBPSU5URVIgPSAxMixcbiAgQ09ERSA9IDEzLFxuICBTWU1CT0wgPSAxNCxcbiAgQ09ERV9XX1NDT1BFID0gMTUsXG4gIElOVCA9IDE2LFxuICBUSU1FU1RBTVAgPSAxNyxcbiAgTE9ORyA9IDE4LFxuICBERUNJTUFMMTI4ID0gMTksXG4gIE1JTl9LRVkgPSAweGZmLFxuICBNQVhfS0VZID0gMHg3Zixcbn1cblxuLyoqIEJpbmFyeSBEZWZhdWx0IFR5cGUgQGludGVybmFsICovXG5leHBvcnQgY29uc3QgQlNPTl9CSU5BUllfU1VCVFlQRV9ERUZBVUxUID0gMDtcbiJdfQ==
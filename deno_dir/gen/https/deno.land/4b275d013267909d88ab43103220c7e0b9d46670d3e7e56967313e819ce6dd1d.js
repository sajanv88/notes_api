export function parseNamespace(ns) {
    const [db, ...rest] = ns.split(".");
    return { db, collection: rest.join(".") };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxNQUFNLFVBQVUsY0FBYyxDQUFDLEVBQVU7SUFDdkMsTUFBTSxDQUFDLEVBQUUsRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDcEMsT0FBTyxFQUFFLEVBQUUsRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO0FBQzVDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gcGFyc2VOYW1lc3BhY2UobnM6IHN0cmluZykge1xuICBjb25zdCBbZGIsIC4uLnJlc3RdID0gbnMuc3BsaXQoXCIuXCIpO1xuICByZXR1cm4geyBkYiwgY29sbGVjdGlvbjogcmVzdC5qb2luKFwiLlwiKSB9O1xufVxuIl19
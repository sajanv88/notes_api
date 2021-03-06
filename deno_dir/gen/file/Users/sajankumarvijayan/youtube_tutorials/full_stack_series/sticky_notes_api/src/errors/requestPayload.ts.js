class RequestPayloadException extends Error {
    #message;
    constructor(message) {
        super(message);
        this.name = 'RequestPayloadException';
        this.#message = message;
    }
    getCode = () => 400;
    toString = () => {
        return `{"name": "${this.name}", "message":"${this.#message}", "code": ${this.getCode()}}`;
    };
}
export default RequestPayloadException;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdFBheWxvYWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZXF1ZXN0UGF5bG9hZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxNQUFNLHVCQUF3QixTQUFRLEtBQUs7SUFDdkMsUUFBUSxDQUFTO0lBQ2pCLFlBQVksT0FBZTtRQUN2QixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsSUFBSSxHQUFHLHlCQUF5QixDQUFDO1FBQ3RDLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDO0lBQzVCLENBQUM7SUFFRCxPQUFPLEdBQUcsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDO0lBRXBCLFFBQVEsR0FBRyxHQUFHLEVBQUU7UUFDWixPQUFPLGFBQWEsSUFBSSxDQUFDLElBQUksaUJBQWlCLElBQUksQ0FBQyxRQUFRLGNBQWMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUE7SUFDOUYsQ0FBQyxDQUFBO0NBQ0o7QUFFRCxlQUFlLHVCQUF1QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiY2xhc3MgUmVxdWVzdFBheWxvYWRFeGNlcHRpb24gZXh0ZW5kcyBFcnJvciB7XG4gICAgI21lc3NhZ2U6IHN0cmluZztcbiAgICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICAgICAgc3VwZXIobWVzc2FnZSk7XG4gICAgICAgIHRoaXMubmFtZSA9ICdSZXF1ZXN0UGF5bG9hZEV4Y2VwdGlvbic7XG4gICAgICAgIHRoaXMuI21lc3NhZ2UgPSBtZXNzYWdlO1xuICAgIH1cblxuICAgIGdldENvZGUgPSAoKSA9PiA0MDA7XG5cbiAgICB0b1N0cmluZyA9ICgpID0+IHtcbiAgICAgICAgcmV0dXJuIGB7XCJuYW1lXCI6IFwiJHt0aGlzLm5hbWV9XCIsIFwibWVzc2FnZVwiOlwiJHt0aGlzLiNtZXNzYWdlfVwiLCBcImNvZGVcIjogJHt0aGlzLmdldENvZGUoKX19YFxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUmVxdWVzdFBheWxvYWRFeGNlcHRpb247Il19
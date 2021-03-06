class ConflictException extends Error {
    #message;
    constructor(message) {
        super(message);
        this.#message = message;
        this.name = 'ConflictException';
    }
    getCode = () => 409;
    toString = () => {
        return `{"name": "${this.name}", "message": ${this.#message}, "code": ${this.getCode()}}`;
    };
}
export default ConflictException;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmxpY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjb25mbGljdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxNQUFNLGlCQUFrQixTQUFRLEtBQUs7SUFFakMsUUFBUSxDQUFTO0lBQ2pCLFlBQVksT0FBZTtRQUN2QixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUE7UUFDZCxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQztRQUN4QixJQUFJLENBQUMsSUFBSSxHQUFHLG1CQUFtQixDQUFBO0lBQ25DLENBQUM7SUFFRCxPQUFPLEdBQUcsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDO0lBRXBCLFFBQVEsR0FBRyxHQUFHLEVBQUU7UUFDWixPQUFPLGFBQWEsSUFBSSxDQUFDLElBQUksaUJBQWlCLElBQUksQ0FBQyxRQUFRLGFBQWEsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUE7SUFDN0YsQ0FBQyxDQUFBO0NBQ0o7QUFFRCxlQUFlLGlCQUFpQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiY2xhc3MgQ29uZmxpY3RFeGNlcHRpb24gZXh0ZW5kcyBFcnJvciB7XG5cbiAgICAjbWVzc2FnZTogc3RyaW5nO1xuICAgIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZykge1xuICAgICAgICBzdXBlcihtZXNzYWdlKVxuICAgICAgICB0aGlzLiNtZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgdGhpcy5uYW1lID0gJ0NvbmZsaWN0RXhjZXB0aW9uJ1xuICAgIH1cblxuICAgIGdldENvZGUgPSAoKSA9PiA0MDk7XG5cbiAgICB0b1N0cmluZyA9ICgpID0+IHtcbiAgICAgICAgcmV0dXJuIGB7XCJuYW1lXCI6IFwiJHt0aGlzLm5hbWV9XCIsIFwibWVzc2FnZVwiOiAke3RoaXMuI21lc3NhZ2V9LCBcImNvZGVcIjogJHt0aGlzLmdldENvZGUoKX19YFxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ29uZmxpY3RFeGNlcHRpb247Il19
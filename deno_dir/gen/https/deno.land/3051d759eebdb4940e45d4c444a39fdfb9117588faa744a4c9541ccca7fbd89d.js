import { Database } from "./database.ts";
import { parse } from "./utils/uri.ts";
import { MongoDriverError } from "./error.ts";
import { Cluster } from "./cluster.ts";
export class MongoClient {
    #cluster;
    #defaultDbName = "admin";
    #buildInfo;
    get buildInfo() {
        return this.#buildInfo;
    }
    getCluster() {
        if (!this.#cluster) {
            throw new MongoDriverError("MongoClient is no connected to the Database");
        }
        return this.#cluster;
    }
    async connect(options) {
        try {
            const parsedOptions = typeof options === "string"
                ? await parse(options)
                : options;
            this.#defaultDbName = parsedOptions.db;
            const cluster = new Cluster(parsedOptions);
            await cluster.connect();
            await cluster.authenticate();
            await cluster.updateMaster();
            this.#cluster = cluster;
            this.#buildInfo = await this.runCommand(this.#defaultDbName, {
                buildInfo: 1,
            });
        }
        catch (e) {
            throw new MongoDriverError(`Connection failed: ${e.message || e}`);
        }
        return this.database(options.db);
    }
    async listDatabases(options = {}) {
        const { databases } = await this.getCluster().protocol.commandSingle("admin", {
            listDatabases: 1,
            ...options,
        });
        return databases;
    }
    runCommand(db, body) {
        return this.getCluster().protocol.commandSingle(db, body);
    }
    database(name = this.#defaultDbName) {
        return new Database(this.getCluster(), name);
    }
    close() {
        if (this.#cluster)
            this.#cluster.close();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2xpZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFPekMsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUM5QyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBRXZDLE1BQU0sT0FBTyxXQUFXO0lBQ3RCLFFBQVEsQ0FBVztJQUNuQixjQUFjLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLFVBQVUsQ0FBYTtJQUV2QixJQUFJLFNBQVM7UUFDWCxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDekIsQ0FBQztJQUVELFVBQVU7UUFDUixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTtZQUNsQixNQUFNLElBQUksZ0JBQWdCLENBQUMsNkNBQTZDLENBQUMsQ0FBQztTQUMzRTtRQUVELE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUN2QixDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU8sQ0FDWCxPQUFnQztRQUVoQyxJQUFJO1lBQ0YsTUFBTSxhQUFhLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUTtnQkFDL0MsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLE9BQU8sQ0FBQztnQkFDdEIsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUVaLElBQUksQ0FBQyxjQUFjLEdBQUcsYUFBYSxDQUFDLEVBQUUsQ0FBQztZQUN2QyxNQUFNLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUMzQyxNQUFNLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN4QixNQUFNLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUM3QixNQUFNLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUU3QixJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQztZQUN4QixJQUFJLENBQUMsVUFBVSxHQUFHLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFO2dCQUMzRCxTQUFTLEVBQUUsQ0FBQzthQUNiLENBQUMsQ0FBQztTQUNKO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDVixNQUFNLElBQUksZ0JBQWdCLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUNwRTtRQUNELE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBRSxPQUEwQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7SUFFRCxLQUFLLENBQUMsYUFBYSxDQUFDLFVBS2hCLEVBQUU7UUFDSixNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FDbEUsT0FBTyxFQUNQO1lBQ0UsYUFBYSxFQUFFLENBQUM7WUFDaEIsR0FBRyxPQUFPO1NBQ1gsQ0FDRixDQUFDO1FBQ0YsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUdELFVBQVUsQ0FBVSxFQUFVLEVBQUUsSUFBYztRQUM1QyxPQUFPLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRUQsUUFBUSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsY0FBYztRQUNqQyxPQUFPLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRUQsS0FBSztRQUNILElBQUksSUFBSSxDQUFDLFFBQVE7WUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQzNDLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERhdGFiYXNlIH0gZnJvbSBcIi4vZGF0YWJhc2UudHNcIjtcbmltcG9ydCB7XG4gIEJ1aWxkSW5mbyxcbiAgQ29ubmVjdE9wdGlvbnMsXG4gIERvY3VtZW50LFxuICBMaXN0RGF0YWJhc2VJbmZvLFxufSBmcm9tIFwiLi90eXBlcy50c1wiO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tIFwiLi91dGlscy91cmkudHNcIjtcbmltcG9ydCB7IE1vbmdvRHJpdmVyRXJyb3IgfSBmcm9tIFwiLi9lcnJvci50c1wiO1xuaW1wb3J0IHsgQ2x1c3RlciB9IGZyb20gXCIuL2NsdXN0ZXIudHNcIjtcblxuZXhwb3J0IGNsYXNzIE1vbmdvQ2xpZW50IHtcbiAgI2NsdXN0ZXI/OiBDbHVzdGVyO1xuICAjZGVmYXVsdERiTmFtZSA9IFwiYWRtaW5cIjtcbiAgI2J1aWxkSW5mbz86IEJ1aWxkSW5mbztcblxuICBnZXQgYnVpbGRJbmZvKCkge1xuICAgIHJldHVybiB0aGlzLiNidWlsZEluZm87XG4gIH1cblxuICBnZXRDbHVzdGVyKCkge1xuICAgIGlmICghdGhpcy4jY2x1c3Rlcikge1xuICAgICAgdGhyb3cgbmV3IE1vbmdvRHJpdmVyRXJyb3IoXCJNb25nb0NsaWVudCBpcyBubyBjb25uZWN0ZWQgdG8gdGhlIERhdGFiYXNlXCIpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLiNjbHVzdGVyO1xuICB9XG5cbiAgYXN5bmMgY29ubmVjdChcbiAgICBvcHRpb25zOiBDb25uZWN0T3B0aW9ucyB8IHN0cmluZyxcbiAgKTogUHJvbWlzZTxEYXRhYmFzZT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYXJzZWRPcHRpb25zID0gdHlwZW9mIG9wdGlvbnMgPT09IFwic3RyaW5nXCJcbiAgICAgICAgPyBhd2FpdCBwYXJzZShvcHRpb25zKVxuICAgICAgICA6IG9wdGlvbnM7XG5cbiAgICAgIHRoaXMuI2RlZmF1bHREYk5hbWUgPSBwYXJzZWRPcHRpb25zLmRiO1xuICAgICAgY29uc3QgY2x1c3RlciA9IG5ldyBDbHVzdGVyKHBhcnNlZE9wdGlvbnMpO1xuICAgICAgYXdhaXQgY2x1c3Rlci5jb25uZWN0KCk7XG4gICAgICBhd2FpdCBjbHVzdGVyLmF1dGhlbnRpY2F0ZSgpO1xuICAgICAgYXdhaXQgY2x1c3Rlci51cGRhdGVNYXN0ZXIoKTtcblxuICAgICAgdGhpcy4jY2x1c3RlciA9IGNsdXN0ZXI7XG4gICAgICB0aGlzLiNidWlsZEluZm8gPSBhd2FpdCB0aGlzLnJ1bkNvbW1hbmQodGhpcy4jZGVmYXVsdERiTmFtZSwge1xuICAgICAgICBidWlsZEluZm86IDEsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aHJvdyBuZXcgTW9uZ29Ecml2ZXJFcnJvcihgQ29ubmVjdGlvbiBmYWlsZWQ6ICR7ZS5tZXNzYWdlIHx8IGV9YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmRhdGFiYXNlKChvcHRpb25zIGFzIENvbm5lY3RPcHRpb25zKS5kYik7XG4gIH1cblxuICBhc3luYyBsaXN0RGF0YWJhc2VzKG9wdGlvbnM6IHtcbiAgICBmaWx0ZXI/OiBEb2N1bWVudDtcbiAgICBuYW1lT25seT86IGJvb2xlYW47XG4gICAgYXV0aG9yaXplZENvbGxlY3Rpb25zPzogYm9vbGVhbjtcbiAgICBjb21tZW50PzogRG9jdW1lbnQ7XG4gIH0gPSB7fSk6IFByb21pc2U8TGlzdERhdGFiYXNlSW5mb1tdPiB7XG4gICAgY29uc3QgeyBkYXRhYmFzZXMgfSA9IGF3YWl0IHRoaXMuZ2V0Q2x1c3RlcigpLnByb3RvY29sLmNvbW1hbmRTaW5nbGUoXG4gICAgICBcImFkbWluXCIsXG4gICAgICB7XG4gICAgICAgIGxpc3REYXRhYmFzZXM6IDEsXG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICB9LFxuICAgICk7XG4gICAgcmV0dXJuIGRhdGFiYXNlcztcbiAgfVxuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIHJ1bkNvbW1hbmQ8VCA9IGFueT4oZGI6IHN0cmluZywgYm9keTogRG9jdW1lbnQpOiBQcm9taXNlPFQ+IHtcbiAgICByZXR1cm4gdGhpcy5nZXRDbHVzdGVyKCkucHJvdG9jb2wuY29tbWFuZFNpbmdsZShkYiwgYm9keSk7XG4gIH1cblxuICBkYXRhYmFzZShuYW1lID0gdGhpcy4jZGVmYXVsdERiTmFtZSk6IERhdGFiYXNlIHtcbiAgICByZXR1cm4gbmV3IERhdGFiYXNlKHRoaXMuZ2V0Q2x1c3RlcigpLCBuYW1lKTtcbiAgfVxuXG4gIGNsb3NlKCkge1xuICAgIGlmICh0aGlzLiNjbHVzdGVyKSB0aGlzLiNjbHVzdGVyLmNsb3NlKCk7XG4gIH1cbn1cbiJdfQ==
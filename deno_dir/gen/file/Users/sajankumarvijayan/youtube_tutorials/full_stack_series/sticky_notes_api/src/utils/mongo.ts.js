import { MongoClient } from '../deps.ts';
const MONGODB_URI = Deno.env.get('MONGODB_URI') || 'mongodb://root:2M3zUvUTSnKp0Rc50NUY@mydb.sajankumarv.com:9001/?authSource=admin';
const mongoClient = new MongoClient();
export { MONGODB_URI, mongoClient };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uZ28uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJtb25nby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRXpDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLGlGQUFpRixDQUFBO0FBQ3BJLE1BQU0sV0FBVyxHQUFHLElBQUksV0FBVyxFQUFFLENBQUM7QUFFdEMsT0FBTyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE1vbmdvQ2xpZW50IH0gZnJvbSAnLi4vZGVwcy50cyc7XG5cbmNvbnN0IE1PTkdPREJfVVJJID0gRGVuby5lbnYuZ2V0KCdNT05HT0RCX1VSSScpIHx8ICdtb25nb2RiOi8vcm9vdDoyTTN6VXZVVFNuS3AwUmM1ME5VWUBteWRiLnNhamFua3VtYXJ2LmNvbTo5MDAxLz9hdXRoU291cmNlPWFkbWluJyAvLyAnbW9uZ29kYjovL3Jvb3Q6cGFzc3dvcmRAbG9jYWxob3N0OjI3MDE3P2F1dGhTb3VyY2U9YWRtaW4nO1xuY29uc3QgbW9uZ29DbGllbnQgPSBuZXcgTW9uZ29DbGllbnQoKTtcblxuZXhwb3J0IHsgTU9OR09EQl9VUkksIG1vbmdvQ2xpZW50IH0iXX0=
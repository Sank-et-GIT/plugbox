import axios from "axios";

export const API_BASE_URL = "http://64.227.166.155:8080";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

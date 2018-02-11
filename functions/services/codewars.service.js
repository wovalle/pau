module.exports = class CodewarsService {
  constructor({ http, apiUrl = '', logger }) {
    this.http = http;
    this.baseUrl = apiUrl || 'https://www.codewars.com/api/v1/';
    this.logger = logger;
    this.request = (url, authHeader) => this.http.get(url, {
      headers: {
        Authorization: authHeader,
      },
    });
  }

  getExcercises(userId, apiKey) {
    const url = `${this.baseUrl}users/${userId}/code-challenges/completed?page=0`;
    this.logger.info('Querying codewars with', url, apiKey);
    return this.request(url, apiKey);
  }
};

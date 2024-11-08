// src/services/AirtableService.js
import Airtable from 'airtable';

const AIRTABLE_API_KEY = process.env.REACT_APP_AIRTABLE_API_KEY;
const BASE_ID = process.env.REACT_APP_AIRTABLE_BASE_ID;

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(BASE_ID);

class AirtableService {
  static async fetchVideosAndClips() {
    try {
      const videos = await base('Videos').select().all();
      const clips = await base('Clips').select().all();

      return {
        videos: videos.map(record => ({
          id: record.id,
          fields: record.fields
        })),
        clips: clips.map(record => ({
          id: record.id,
          fields: record.fields
        }))
      };
    } catch (error) {
      console.error('Error fetching videos and clips:', error);
      throw error;
    }
  }
}

export default AirtableService;
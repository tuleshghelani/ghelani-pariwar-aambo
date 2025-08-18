import { Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  constructor(
    private meta: Meta,
    private title: Title
  ) {}

  updateTitle(title: string) {
    this.title.setTitle(title);
  }

  updateMetaTags(tags: {
    description?: string;
    keywords?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogUrl?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
  }) {
    // Core meta tags
    if (tags.description) {
      this.meta.updateTag({ name: 'description', content: tags.description });
    }
    
    if (tags.keywords) {
      this.meta.updateTag({ name: 'keywords', content: tags.keywords });
    }
    
    // OpenGraph tags
    if (tags.ogTitle) {
      this.meta.updateTag({ property: 'og:title', content: tags.ogTitle });
    }
    
    if (tags.ogDescription) {
      this.meta.updateTag({ property: 'og:description', content: tags.ogDescription });
    }
    
    if (tags.ogImage) {
      this.meta.updateTag({ property: 'og:image', content: tags.ogImage });
    }
    
    if (tags.ogUrl) {
      this.meta.updateTag({ property: 'og:url', content: tags.ogUrl });
    }
    
    // Twitter Card tags
    if (tags.twitterTitle) {
      this.meta.updateTag({ name: 'twitter:title', content: tags.twitterTitle });
    }
    
    if (tags.twitterDescription) {
      this.meta.updateTag({ name: 'twitter:description', content: tags.twitterDescription });
    }
    
    if (tags.twitterImage) {
      this.meta.updateTag({ name: 'twitter:image', content: tags.twitterImage });
    }
  }
} 
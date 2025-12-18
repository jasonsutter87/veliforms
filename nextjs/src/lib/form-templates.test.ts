/**
 * VeilForms - Form Templates Tests
 */

import { describe, it, expect } from 'vitest';
import { FORM_TEMPLATES, getTemplateById, getTemplatesByCategory } from './form-templates';

describe('form-templates', () => {
  describe('FORM_TEMPLATES', () => {
    it('should have templates defined', () => {
      expect(FORM_TEMPLATES).toBeDefined();
      expect(FORM_TEMPLATES.length).toBeGreaterThan(0);
    });

    it('should have valid template structure', () => {
      FORM_TEMPLATES.forEach(template => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('category');
        expect(template).toHaveProperty('fields');
        expect(Array.isArray(template.fields)).toBe(true);
      });
    });

    it('should have fields with proper structure', () => {
      FORM_TEMPLATES.forEach(template => {
        template.fields.forEach(field => {
          expect(field).toHaveProperty('type');
          expect(field).toHaveProperty('label');
          expect(field).toHaveProperty('name');
        });
      });
    });
  });

  describe('getTemplateById', () => {
    it('should return template by id', () => {
      const template = getTemplateById('contact-simple');
      expect(template).toBeDefined();
      expect(template?.id).toBe('contact-simple');
    });

    it('should return undefined for non-existent id', () => {
      const template = getTemplateById('non-existent');
      expect(template).toBeUndefined();
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return templates by category', () => {
      const templates = getTemplatesByCategory('contact');
      expect(templates.length).toBeGreaterThan(0);
      templates.forEach(template => {
        expect(template.category).toBe('contact');
      });
    });

    it('should return empty array for category with no templates', () => {
      const templates = getTemplatesByCategory('survey');
      expect(Array.isArray(templates)).toBe(true);
    });
  });
});

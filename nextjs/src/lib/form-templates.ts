/**
 * VeilForms - Form Templates Library
 * Pre-built form templates for common use cases
 */

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: 'contact' | 'feedback' | 'registration' | 'survey' | 'order';
  fields: Array<{
    type: string;
    label: string;
    name: string;
    required?: boolean;
    placeholder?: string;
    options?: string[];
    validation?: Record<string, unknown>;
  }>;
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'contact-simple',
    name: 'Simple Contact Form',
    description: 'Basic contact form with name, email, and message',
    category: 'contact',
    fields: [
      { type: 'text', label: 'Full Name', name: 'name', required: true, placeholder: 'John Doe' },
      { type: 'email', label: 'Email Address', name: 'email', required: true, placeholder: 'john@example.com' },
      { type: 'textarea', label: 'Message', name: 'message', required: true, placeholder: 'How can we help?' },
    ],
  },
  {
    id: 'contact-detailed',
    name: 'Detailed Contact Form',
    description: 'Contact form with phone, company, and subject',
    category: 'contact',
    fields: [
      { type: 'text', label: 'Full Name', name: 'name', required: true },
      { type: 'email', label: 'Email', name: 'email', required: true },
      { type: 'phone', label: 'Phone Number', name: 'phone', required: false },
      { type: 'text', label: 'Company', name: 'company', required: false },
      { type: 'select', label: 'Subject', name: 'subject', required: true, options: ['General Inquiry', 'Support', 'Sales', 'Partnership'] },
      { type: 'textarea', label: 'Message', name: 'message', required: true },
    ],
  },
  {
    id: 'feedback',
    name: 'Customer Feedback',
    description: 'Collect customer satisfaction and feedback',
    category: 'feedback',
    fields: [
      { type: 'email', label: 'Email (optional)', name: 'email', required: false },
      { type: 'radio', label: 'How satisfied are you?', name: 'satisfaction', required: true, options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'] },
      { type: 'radio', label: 'Would you recommend us?', name: 'recommend', required: true, options: ['Definitely', 'Probably', 'Not Sure', 'Probably Not', 'Definitely Not'] },
      { type: 'textarea', label: 'What could we improve?', name: 'improvements', required: false },
      { type: 'textarea', label: 'Additional comments', name: 'comments', required: false },
    ],
  },
  {
    id: 'event-registration',
    name: 'Event Registration',
    description: 'Sign up attendees for events',
    category: 'registration',
    fields: [
      { type: 'text', label: 'Full Name', name: 'name', required: true },
      { type: 'email', label: 'Email', name: 'email', required: true },
      { type: 'phone', label: 'Phone', name: 'phone', required: false },
      { type: 'text', label: 'Company/Organization', name: 'organization', required: false },
      { type: 'select', label: 'Ticket Type', name: 'ticket_type', required: true, options: ['General Admission', 'VIP', 'Student'] },
      { type: 'checkbox', label: 'Dietary Restrictions', name: 'dietary', required: false, options: ['Vegetarian', 'Vegan', 'Gluten-Free', 'Kosher', 'Halal'] },
      { type: 'textarea', label: 'Special Requirements', name: 'special_requirements', required: false },
    ],
  },
  {
    id: 'job-application',
    name: 'Job Application',
    description: 'Collect job applications',
    category: 'registration',
    fields: [
      { type: 'text', label: 'Full Name', name: 'name', required: true },
      { type: 'email', label: 'Email', name: 'email', required: true },
      { type: 'phone', label: 'Phone', name: 'phone', required: true },
      { type: 'url', label: 'LinkedIn Profile', name: 'linkedin', required: false },
      { type: 'url', label: 'Portfolio/Website', name: 'portfolio', required: false },
      { type: 'select', label: 'Position', name: 'position', required: true, options: ['Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Designer', 'Product Manager'] },
      { type: 'textarea', label: 'Why do you want to join?', name: 'motivation', required: true },
      { type: 'textarea', label: 'Relevant Experience', name: 'experience', required: true },
    ],
  },
  {
    id: 'newsletter',
    name: 'Newsletter Signup',
    description: 'Simple email subscription form',
    category: 'contact',
    fields: [
      { type: 'text', label: 'First Name', name: 'first_name', required: false },
      { type: 'email', label: 'Email Address', name: 'email', required: true },
      { type: 'checkbox', label: 'Interests', name: 'interests', required: false, options: ['Product Updates', 'Tips & Tutorials', 'Company News', 'Promotions'] },
    ],
  },
];

export function getTemplateById(id: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: FormTemplate['category']): FormTemplate[] {
  return FORM_TEMPLATES.filter(t => t.category === category);
}

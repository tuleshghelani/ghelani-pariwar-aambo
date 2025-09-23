import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import Aos from 'aos';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PersonService } from '../../services/person.service';
import { DataValidatorService } from '../../services/data-validator.service';
import { Person } from '../../models/person.model';
import { CanvasTreeComponent } from '../../components/canvas-tree/canvas-tree.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, CanvasTreeComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  personData: Person | null = null;
  loading = true;
  error = false;
  errorMessage = '';
  validationErrors: string[] = [];

  constructor(
    private sanitizer: DomSanitizer,
    private meta: Meta,
    private title: Title,
    private personService: PersonService,
    private dataValidator: DataValidatorService
  ) {
    this.setupSEO();
  }
  
  private setupSEO() {
    this.title.setTitle('Family Tree View - Ambo/Vansh Vela');
    this.meta.updateTag({ name: 'description', content: 'Hierarchical tree view of Ambo/Vansh Vela family relationships' });
  }

  ngOnInit() {
    this.loadPersonData();
  }

  /**
   * Load person hierarchy data from the service
   */
  loadPersonData(): void {
    this.loading = true;
    this.error = false;
    this.validationErrors = [];
    
    this.personService.getPersonHierarchy().subscribe({
      next: (data) => {
        this.personData = data;
        this.loading = false;
        
        // Validate the data structure
        this.validationErrors = this.dataValidator.validatePersonData(data);
        if (this.validationErrors.length > 0) {
          console.warn('Data validation warnings:', this.validationErrors);
        }
      },
      error: (err) => {
        this.error = true;
        this.loading = false;
        this.errorMessage = 'Failed to load person data';
        this.personService.logError(`Error loading person data: ${err.message}`);
      }
    });
  }

}

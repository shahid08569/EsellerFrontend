import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from 'eseller-shared';
import { CustomerBlogPostDto, CustomerBlogPagedResult } from '../models/blog.models';

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly api = inject(ApiService);

  getPosts(pageNumber: number = 1, pageSize: number = 12, search?: string): Observable<CustomerBlogPagedResult> {
    let url = `/blog/posts?pageNumber=${pageNumber}&pageSize=${pageSize}`;
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    return this.api.get<any>(url).pipe(
      map(res => {
        if (res && Array.isArray(res.items)) {
          return {
            items: res.items,
            totalCount: res.totalCount ?? res.items.length,
            pageNumber: res.pageNumber ?? 1,
            pageSize: res.pageSize ?? pageSize,
            totalPages: res.totalPages ?? Math.ceil((res.totalCount ?? res.items.length) / pageSize)
          };
        }
        if (Array.isArray(res)) {
          return {
            items: res,
            totalCount: res.length,
            pageNumber: 1,
            pageSize: res.length,
            totalPages: 1
          };
        }
        return { items: [], totalCount: 0, pageNumber: 1, pageSize, totalPages: 0 };
      }),
      catchError(() => of({ items: [], totalCount: 0, pageNumber: 1, pageSize, totalPages: 0 }))
    );
  }

  getPostBySlug(slug: string): Observable<CustomerBlogPostDto | null> {
    return this.api.get<CustomerBlogPostDto>(`/blog/posts/${slug}`).pipe(
      catchError(() => of(null))
    );
  }
}

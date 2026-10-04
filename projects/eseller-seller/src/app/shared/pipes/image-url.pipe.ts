import { Pipe, PipeTransform } from '@angular/core';
import { resolveImageUrl } from '../../core/utils/image.util';

@Pipe({
  name: 'imageUrl',
  standalone: true
})
export class ImageUrlPipe implements PipeTransform {
  transform(value: string | null | undefined): string | null {
    return resolveImageUrl(value);
  }
}

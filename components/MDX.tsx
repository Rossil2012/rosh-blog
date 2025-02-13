import { FC } from 'react';
import Image from 'next/image';
import { useMDXComponent } from 'next-contentlayer2/hooks';

export interface MDXProps {
  code: string;
}

const MDX: FC<MDXProps> = ({ code }) => {
  const Component = useMDXComponent(code);

  return (
    <Component 
      components={{ // Override html elements here.
        img: (props: any) => <Image alt={props.alt || 'Default description'} {...props} /> 
      }} 
    />
  );
};

export default MDX;

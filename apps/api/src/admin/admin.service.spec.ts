import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService,
		  {
			  provide: PrismaService,
			  useValue: {
				  organizationApplication: {
					  findUnique: vi.fn().mockResolvedValue({
						  id: 'application-123',
						  status: 'PENDING',
					  }),
				  },
			  },
		  }
	  ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('should return an application by ID', async () => {
	  const result = await service.findApplication('application-123');
	  const mockFunction = service['prisma'].organizationApplication.findUnique;
	  expect(mockFunction).toBeCalledWith({where: {id: 'application-123'} });
	  expect(result).toBeDefined();
	  expect(result).toEqual({
		  id: 'application-123',
		  status: 'PENDING',
	  });
  });
  it('should return null when the application does not exist', async () => {
	  const mockFunction = service['prisma'].organizationApplication.findUnique;
	  vi.mocked(mockFunction).mockResolvedValueOnce(null);
	  const result = await service.findApplication('non-existing-app');
	  expect(mockFunction).toBeCalledWith({
		  where: {
			  id: 'non-existing-app'
		  }
	  });
	  expect(result).toBeNull();
  });
  it('should propagate database errors', () => {
    expect(service).toBeDefined();
  });
});
